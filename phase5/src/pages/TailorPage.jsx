import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, FileText, ChevronRight, ChevronDown, Wand2,
  CheckCircle, AlertCircle, Download, RotateCcw, Eye,
  Trash2, Clock, Zap, User, BarChart2, Save, FileDown,
} from 'lucide-react';
import { extractTextFromFile, parseResume } from '../utils/resumeParser.js';
import { runScoredTailoring } from '../utils/scoreGate.js';
import { getSectionBreakdown } from '../utils/atsScorer.js';
import { flattenHumanScores } from '../utils/humanScorer.js';
import { saveBaseResume, getBaseResume, saveTailoredResume, getTailoredResumesForJob, generateVersionId, deleteTailoredResume } from '../store/resumeStore.js';
import { getAllJobs } from '../store/db.js';
import { getApiKey, getProvider } from '../store/settings.js';
import { exportResumePDF } from '../utils/pdfExport.js';
import { toast } from '../components/Toast.jsx';

// ─── Step constants ───────────────────────────────────────────────────────────
const STEPS = ['RESUME', 'JOB', 'GENERATE', 'REVIEW'];

export default function TailorPage() {
  const [step, setStep] = useState(0);
  const [baseResume, setBaseResume] = useState(null);          // { raw, header, sections, wordCount, ... }
  const [experienceLevel, setExperienceLevel] = useState('fresher');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [progressLog, setProgressLog] = useState([]);
  const [streamText, setStreamText] = useState('');
  const [result, setResult] = useState(null);                  // final scoreGate result
  const [activeVersionId, setActiveVersionId] = useState(null);
  const [savedVersions, setSavedVersions] = useState([]);
  const [reviewTab, setReviewTab] = useState('preview');       // 'preview' | 'ats' | 'human'
  const streamRef = useRef('');

  // Load saved base resume + jobs on mount
  useEffect(() => {
    getBaseResume().then(r => r && setBaseResume(r));
    getAllJobs().then(j => setJobs(j.sort((a, b) => b.createdAt - a.createdAt)));
  }, []);

  // Load saved versions when job is selected
  useEffect(() => {
    if (selectedJob) {
      getTailoredResumesForJob(selectedJob.id).then(v =>
        setSavedVersions(v.sort((a, b) => b.createdAt - a.createdAt))
      );
    }
  }, [selectedJob]);

  // ── Step 1: Upload Resume ─────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await extractTextFromFile(file);
      const parsed = parseResume(text);
      const resumeData = { ...parsed, fileName: file.name };
      await saveBaseResume(resumeData);
      setBaseResume(resumeData);
      toast(`Resume loaded: ${parsed.header?.name || file.name}`, 'success');
    } catch (err) {
      toast('Failed to read file: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  const handlePasteResume = (text) => {
    const parsed = parseResume(text);
    const resumeData = { ...parsed, fileName: 'pasted' };
    saveBaseResume(resumeData);
    setBaseResume(resumeData);
    toast('Resume parsed from paste', 'success');
  };

  // ── Step 3: Generate ──────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!baseResume || !selectedJob) return;
    const apiKey = getApiKey();
    if (!apiKey) { toast('Add your Groq API key in Settings first', 'error'); return; }

    setGenerating(true);
    setProgressLog([]);
    setStreamText('');
    streamRef.current = '';
    setResult(null);
    setStep(2);

    const addLog = (msg) => setProgressLog(prev => [...prev, { msg, ts: Date.now() }]);

    try {
      const res = await runScoredTailoring({
        parsedResume: baseResume,
        job: selectedJob,
        experienceLevel,
        apiKey,
        provider: getProvider(),
        onProgress: addLog,
        onStream: (partial) => {
          streamRef.current = partial;
          setStreamText(partial);
        },
      });

      setResult(res);
      setStep(3);

      if (res.passed) {
        toast(`✓ Passed! ATS: ${res.atsResult.score} · Human: ${res.humanResult?.totalScore}`, 'success');
      } else {
        toast(`Best result: ATS ${res.atsResult.score} · Human ${res.humanResult?.totalScore || '?'} — manual review needed`, 'warning');
      }
    } catch (err) {
      toast('Generation failed: ' + err.message, 'error');
      setStep(1);
    } finally {
      setGenerating(false);
    }
  };

  // ── Save version ──────────────────────────────────────────────────────────
  const handleSaveVersion = async () => {
    if (!result || !selectedJob) return;
    const id = generateVersionId(selectedJob.id);
    const version = {
      id,
      jobId: selectedJob.id,
      resumeMarkdown: result.resumeText,
      atsScore: result.atsResult.score,
      humanScore: result.humanResult?.totalScore || 0,
      passed: result.passed,
      attempt: result.attempt,
      allAttempts: result.allAttempts?.length,
      sectionBreakdown: getSectionBreakdown(result.resumeText, selectedJob),
      humanDetails: result.humanResult,
      createdAt: Date.now(),
    };
    await saveTailoredResume(version);
    setSavedVersions(prev => [version, ...prev]);
    setActiveVersionId(id);
    toast('Version saved', 'success');
  };

  const handleDeleteVersion = async (id) => {
    await deleteTailoredResume(id);
    setSavedVersions(prev => prev.filter(v => v.id !== id));
    if (activeVersionId === id) setActiveVersionId(null);
    toast('Version deleted', 'info');
  };

  const handleDownloadMd = (text, label) => {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume_${label}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Downloaded as .md', 'success');
  };


  const handleDownloadPdf = async (text, label) => {
    const filename = `${label}_Resume`.replace(/[^a-zA-Z0-9_]/g, '_');
    try {
      await exportResumePDF(text, filename, (msg) => toast(msg, 'info'));
      toast('PDF downloaded!', 'success');
    } catch (err) {
      toast('PDF export failed: ' + err.message, 'error');
    }
  };

  const canProceed = [
    !!baseResume,
    !!selectedJob,
    true, // generate step managed by button
    true,
  ];

  return (
    <div style={{ padding: '40px', maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '6px' }}>
          PHASE 2 · RESUME TAILOR ENGINE
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '8px' }}>
          Tailor Resume
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6, maxWidth: '560px' }}>
          Upload your base resume, select a job, and get a protocol-compliant tailored version
          scored against ATS and human-recruiter rubrics. Auto-retries until it passes.
        </p>
      </div>

      {/* Step indicator */}
      <StepBar steps={STEPS} current={step} canProceed={canProceed} onJump={i => {
        if (i < step || canProceed[i - 1]) setStep(i);
      }} />

      <div style={{ marginTop: '32px' }}>
        {/* ══ STEP 0: RESUME UPLOAD ════════════════════════════════════════ */}
        {step === 0 && (
          <div className="fade-in">
            <ResumeUploadStep
              baseResume={baseResume}
              experienceLevel={experienceLevel}
              onExperienceLevelChange={setExperienceLevel}
              onFileUpload={handleFileUpload}
              onPaste={handlePasteResume}
              onNext={() => setStep(1)}
            />
          </div>
        )}

        {/* ══ STEP 1: JOB SELECT ══════════════════════════════════════════ */}
        {step === 1 && (
          <div className="fade-in">
            <JobSelectStep
              jobs={jobs}
              selectedJob={selectedJob}
              onSelect={setSelectedJob}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          </div>
        )}

        {/* ══ STEP 2: GENERATE ════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="fade-in">
            <GenerateStep
              baseResume={baseResume}
              selectedJob={selectedJob}
              generating={generating}
              progressLog={progressLog}
              streamText={streamText}
              onGenerate={handleGenerate}
              onBack={() => setStep(1)}
            />
          </div>
        )}

        {/* ══ STEP 3: REVIEW ══════════════════════════════════════════════ */}
        {step === 3 && result && (
          <div className="fade-in">
            <ReviewStep
              result={result}
              selectedJob={selectedJob}
              savedVersions={savedVersions}
              activeVersionId={activeVersionId}
              reviewTab={reviewTab}
              onTabChange={setReviewTab}
              onSaveVersion={handleSaveVersion}
              onDeleteVersion={handleDeleteVersion}
              onDownload={handleDownloadMd}
              onDownloadPdf={handleDownloadPdf}
              onRegenerate={() => { setStep(2); handleGenerate(); }}
              onBack={() => setStep(1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step Bar ─────────────────────────────────────────────────────────────────
function StepBar({ steps, current, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
      {steps.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => onJump(i)} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px',
          }}>
            <span style={{
              width: '24px', height: '24px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
              background: i === current ? 'var(--accent)' : i < current ? 'var(--bg3)' : 'var(--bg2)',
              color: i === current ? '#000' : i < current ? 'var(--green)' : 'var(--text3)',
              border: i < current ? '1px solid var(--green)' : '1px solid var(--border)',
              flexShrink: 0,
            }}>
              {i < current ? '✓' : i + 1}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em',
              color: i === current ? 'var(--text)' : 'var(--text3)',
            }}>{label}</span>
          </button>
          {i < steps.length - 1 && (
            <span style={{ color: 'var(--border2)', margin: '0 4px', fontSize: '12px' }}>›</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 0: Resume Upload ────────────────────────────────────────────────────
function ResumeUploadStep({ baseResume, experienceLevel, onExperienceLevelChange, onFileUpload, onPaste, onNext }) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Left: Upload */}
      <div>
        <SectionLabel>UPLOAD BASE RESUME</SectionLabel>
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '12px', padding: '36px 24px',
          border: `2px dashed ${baseResume ? 'var(--green)' : 'var(--border2)'}`,
          borderRadius: '8px', cursor: 'pointer', background: 'var(--bg2)',
          transition: 'border-color 0.2s',
        }}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = baseResume ? 'var(--green)' : 'var(--border2)'; }}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) onFileUpload({ target: { files: [file], value: '' } });
            e.currentTarget.style.borderColor = 'var(--green)';
          }}
        >
          {baseResume ? (
            <CheckCircle size={28} style={{ color: 'var(--green)' }} />
          ) : (
            <Upload size={28} style={{ color: 'var(--text3)' }} />
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: baseResume ? 'var(--green)' : 'var(--text2)', marginBottom: '4px' }}>
              {baseResume ? (baseResume.fileName || 'Resume loaded') : 'Drop file or click to upload'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>
              .txt · .md · .pdf supported
            </div>
          </div>
          <input type="file" accept=".txt,.md,.pdf" onChange={onFileUpload} style={{ display: 'none' }} />
        </label>

        <div style={{ margin: '12px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>OR</div>

        <button onClick={() => setPasteMode(p => !p)} style={secondaryBtnStyle}>
          <FileText size={13} />
          {pasteMode ? 'HIDE PASTE' : 'PASTE TEXT INSTEAD'}
        </button>

        {pasteMode && (
          <div style={{ marginTop: '12px' }}>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste your resume text here..."
              style={{
                width: '100%', minHeight: '160px',
                background: 'var(--bg)', border: '1px solid var(--border2)',
                borderRadius: '4px', padding: '12px',
                color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px',
                outline: 'none', resize: 'vertical', lineHeight: 1.6,
              }}
            />
            <button onClick={() => { onPaste(pasteText); setPasteMode(false); setPasteText(''); }}
              disabled={!pasteText.trim()}
              style={{ ...primaryBtnStyle(!pasteText.trim()), marginTop: '8px' }}>
              <Zap size={13} /> PARSE RESUME
            </button>
          </div>
        )}
      </div>

      {/* Right: Info + Settings */}
      <div>
        {baseResume && (
          <div className="fade-in" style={{ marginBottom: '16px' }}>
            <SectionLabel>PARSED PREVIEW</SectionLabel>
            <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '14px', background: 'var(--bg2)' }}>
              <Row label="Name" value={baseResume.header?.name || '—'} />
              <Row label="Email" value={baseResume.header?.email || '—'} />
              <Row label="Sections" value={baseResume.detectedSections?.join(', ') || '—'} />
              <Row label="Words" value={`${baseResume.wordCount} (~${baseResume.estimatedPages} page)`} />
              {baseResume.detectedSections?.length < 4 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', marginTop: '8px', lineHeight: 1.5 }}>
                  ⚠ Only {baseResume.detectedSections?.length} sections detected. Ensure your resume has clear headings (SKILLS, PROJECTS, EXPERIENCE, EDUCATION).
                </div>
              )}
            </div>
          </div>
        )}

        <SectionLabel>EXPERIENCE LEVEL</SectionLabel>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['fresher', 'experienced'].map(level => (
            <button key={level} onClick={() => onExperienceLevelChange(level)} style={{
              flex: 1, padding: '12px',
              background: experienceLevel === level ? 'rgba(212,160,23,0.12)' : 'var(--bg2)',
              border: `1px solid ${experienceLevel === level ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: experienceLevel === level ? 'var(--accent)' : 'var(--text2)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {level === 'fresher' ? '0–2 yrs\nFRESHER' : '3+ yrs\nEXPERIENCED'}
            </button>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '6px' }}>
          {experienceLevel === 'fresher' ? 'Strictly 1 page · max ~450 words' : 'Max 2 pages · ~900 words'}
        </div>

        <div style={{ marginTop: '24px' }}>
          <button onClick={onNext} disabled={!baseResume} style={primaryBtnStyle(!baseResume)}>
            NEXT: SELECT JOB <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Job Select ───────────────────────────────────────────────────────
function JobSelectStep({ jobs, selectedJob, onSelect, onBack, onNext }) {
  const [search, setSearch] = useState('');
  const filtered = jobs.filter(j =>
    `${j.company} ${j.role} ${j.domain}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <SectionLabel>SELECT TARGET JOB</SectionLabel>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search company, role, domain..."
          style={{
            flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '4px', padding: '8px 14px',
            color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none',
          }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)', alignSelf: 'center' }}>
          {filtered.length} jobs
        </span>
      </div>

      {jobs.length === 0 ? (
        <Empty msg="No jobs stored. Go to Collector first to add job listings." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '440px', overflowY: 'auto' }}>
          {filtered.map(job => (
            <JobSelectCard key={job.id} job={job} selected={selectedJob?.id === job.id} onSelect={() => onSelect(job)} />
          ))}
        </div>
      )}

      {selectedJob && (
        <div className="fade-in" style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(212,160,23,0.07)', border: '1px solid rgba(212,160,23,0.25)', borderRadius: '6px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', marginBottom: '6px', letterSpacing: '0.08em' }}>SELECTED</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
            {selectedJob.company} — {selectedJob.role}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', marginTop: '3px' }}>
            {selectedJob.seniority} · {selectedJob.location} · {selectedJob.domain}
          </div>
          {selectedJob.mustHaveSkills?.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', marginTop: '6px' }}>
              Must-have: {selectedJob.mustHaveSkills.join(', ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>← BACK</button>
        <button onClick={onNext} disabled={!selectedJob} style={primaryBtnStyle(!selectedJob)}>
          NEXT: GENERATE <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function JobSelectCard({ job, selected, onSelect }) {
  return (
    <button onClick={onSelect} style={{
      width: '100%', textAlign: 'left', padding: '12px 16px',
      background: selected ? 'rgba(212,160,23,0.08)' : 'var(--bg2)',
      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: '6px', cursor: 'pointer',
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: '3px' }}>
            {job.company} <span style={{ fontWeight: 400, color: 'var(--text2)' }}>— {job.role}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[job.seniority, job.location, job.domain].filter(v => v && v !== 'unknown').map(t => (
              <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', background: 'var(--bg3)', padding: '1px 6px', borderRadius: '3px' }}>{t}</span>
            ))}
          </div>
        </div>
        {selected && <CheckCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
      </div>
    </button>
  );
}

// ─── Step 2: Generate ─────────────────────────────────────────────────────────
function GenerateStep({ baseResume, selectedJob, generating, progressLog, streamText, onGenerate, onBack }) {
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [progressLog]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Left: Config + Controls */}
      <div>
        <SectionLabel>GENERATION SUMMARY</SectionLabel>
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg2)', marginBottom: '16px' }}>
          <ConfigRow label="Resume" value={baseResume?.header?.name || baseResume?.fileName || 'Uploaded'} />
          <ConfigRow label="Job" value={`${selectedJob?.company} — ${selectedJob?.role}`} />
          <ConfigRow label="Must-have" value={selectedJob?.mustHaveSkills?.slice(0, 4).join(', ') || '—'} />
          <ConfigRow label="Domain" value={selectedJob?.domain || '—'} />
          <ConfigRow label="Protocol" value="FINAL SYSTEM v1.0" accent />
          <ConfigRow label="Max retries" value="3 attempts" />
          <ConfigRow label="ATS threshold" value="90+ to pass" />
          <ConfigRow label="Human threshold" value="85+ to pass" />
        </div>

        {!generating ? (
          <button onClick={onGenerate} style={primaryBtnStyle(false)}>
            <Wand2 size={15} />
            GENERATE & SCORE
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)' }}>
            <Spinner /> Generating...
          </div>
        )}
        <button onClick={onBack} style={{ ...secondaryBtnStyle, marginTop: '10px' }}>← BACK</button>
      </div>

      {/* Right: Live log + Stream preview */}
      <div>
        {/* Progress log */}
        <SectionLabel>LIVE LOG</SectionLabel>
        <div ref={logRef} style={{
          height: '160px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px',
          border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px',
          background: 'var(--bg)', lineHeight: 1.7, color: 'var(--text2)',
        }}>
          {progressLog.length === 0 && !generating && (
            <span style={{ color: 'var(--text3)' }}>Press Generate to start...</span>
          )}
          {progressLog.map((entry, i) => (
            <div key={i} className="slide-in" style={{ color: entry.msg.includes('✓') ? 'var(--green)' : entry.msg.includes('failed') ? 'var(--red)' : 'var(--text2)' }}>
              <span style={{ color: 'var(--text3)' }}>{new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              {' '}{entry.msg}
            </div>
          ))}
          {generating && <span style={{ animation: 'blink 1s infinite', color: 'var(--accent)' }}>█</span>}
        </div>

        {/* Streaming preview */}
        {streamText && (
          <div style={{ marginTop: '12px' }}>
            <SectionLabel>STREAMING OUTPUT</SectionLabel>
            <div style={{
              height: '220px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px',
              border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px',
              background: 'var(--bg)', lineHeight: 1.8, color: 'var(--text2)', whiteSpace: 'pre-wrap',
            }}>
              {streamText}
              {generating && <span style={{ animation: 'blink 1s infinite', color: 'var(--accent)' }}>█</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────
function ReviewStep({ result, selectedJob, savedVersions, activeVersionId, reviewTab, onTabChange, onSaveVersion, onDeleteVersion, onDownload, onDownloadPdf, onRegenerate, onBack }) {
  const { atsResult, humanResult, passed, needsManualReview, allAttempts } = result;
  const atsBreakdown = getSectionBreakdown(result.resumeText, selectedJob);
  const humanChecks = humanResult ? flattenHumanScores(humanResult) : [];

  return (
    <div>
      {/* Score summary banner */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
        padding: '16px 20px',
        background: passed ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${passed ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
        borderRadius: '8px',
      }}>
        <ScorePill label="ATS SCORE" score={atsResult.score} threshold={90} />
        <ScorePill label="HUMAN SCORE" score={humanResult?.totalScore || 0} threshold={85} />
        <ScorePill label="ATTEMPTS" score={allAttempts?.length || 1} threshold={null} max={3} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          {passed ? (
            <><CheckCircle size={16} style={{ color: 'var(--green)' }} /><span style={{ color: 'var(--green)' }}>PASSED BOTH THRESHOLDS</span></>
          ) : (
            <><AlertCircle size={16} style={{ color: 'var(--amber)' }} /><span style={{ color: 'var(--amber)' }}>MANUAL REVIEW NEEDED</span></>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
        {/* Left: Main content area */}
        <div>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
            {[
              { id: 'preview', label: 'RESUME PREVIEW', icon: <Eye size={12} /> },
              { id: 'ats', label: 'ATS BREAKDOWN', icon: <BarChart2 size={12} /> },
              { id: 'human', label: 'HUMAN SCORER', icon: <User size={12} /> },
            ].map(tab => (
              <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', background: 'none', border: 'none',
                borderBottom: reviewTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px',
                letterSpacing: '0.07em', color: reviewTab === tab.id ? 'var(--accent)' : 'var(--text3)',
                marginBottom: '-1px',
              }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Preview tab */}
          {reviewTab === 'preview' && (
            <div className="fade-in" style={{
              whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '12px',
              lineHeight: 1.8, color: 'var(--text)', background: 'var(--bg2)',
              border: '1px solid var(--border)', borderRadius: '6px',
              padding: '20px 24px', maxHeight: '560px', overflowY: 'auto',
            }}>
              {result.resumeText}
            </div>
          )}

          {/* ATS tab */}
          {reviewTab === 'ats' && (
            <div className="fade-in">
              <ATSBreakdownTable breakdown={atsBreakdown} totalScore={atsResult.score} />
            </div>
          )}

          {/* Human tab */}
          {reviewTab === 'human' && (
            <div className="fade-in">
              {humanResult?.error ? (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--red)', padding: '16px' }}>
                  Human scoring failed: {humanResult.error}
                </div>
              ) : (
                <HumanScoreTable checks={humanChecks} result={humanResult} />
              )}
            </div>
          )}
        </div>

        {/* Right sidebar: actions + versions */}
        <div>
          <SectionLabel>ACTIONS</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <button onClick={onSaveVersion} style={primaryBtnStyle(false)}>
              <Save size={13} /> SAVE VERSION
            </button>
            <button onClick={() => onDownload(result.resumeText, `${selectedJob?.company}_${selectedJob?.role}`.replace(/\s+/g, '_'))} style={secondaryBtnStyle}>
              <Download size={13} /> DOWNLOAD .MD
            </button>
            <button onClick={() => onDownloadPdf?.(result.resumeText, `${selectedJob?.company}_${selectedJob?.role}`.replace(/\s+/g, '_'))} style={secondaryBtnStyle}>
              <FileDown size={13} /> EXPORT PDF
            </button>
            <button onClick={onRegenerate} disabled={!passed === false} style={secondaryBtnStyle}>
              <RotateCcw size={13} /> REGENERATE
            </button>
            <button onClick={onBack} style={ghostBtnStyle}>← NEW JOB</button>
          </div>

          {humanResult?.topStrength && (
            <InfoCard color="var(--green)" label="TOP STRENGTH" text={humanResult.topStrength} />
          )}
          {humanResult?.topWeakness && (
            <InfoCard color="var(--amber)" label="TOP FIX NEEDED" text={humanResult.topWeakness} />
          )}

          {/* Saved versions */}
          {savedVersions.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <SectionLabel>SAVED VERSIONS ({savedVersions.length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {savedVersions.map(v => (
                  <VersionCard key={v.id} version={v} active={activeVersionId === v.id}
                    onDownload={() => onDownload(v.resumeMarkdown, v.id)}
                    onDelete={() => onDeleteVersion(v.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ATS Breakdown Table ──────────────────────────────────────────────────────
function ATSBreakdownTable({ breakdown, totalScore }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 500, color: totalScore >= 90 ? 'var(--green)' : totalScore >= 75 ? 'var(--amber)' : 'var(--red)' }}>
          {totalScore}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text3)' }}>/100 ATS score</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginLeft: '8px', padding: '2px 8px', borderRadius: '3px', background: totalScore >= 90 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: totalScore >= 90 ? 'var(--green)' : 'var(--amber)' }}>
          {totalScore >= 90 ? 'PASS' : totalScore >= 75 ? 'NEAR' : totalScore >= 60 ? 'WEAK' : 'FAIL'}
        </span>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 60px 60px 1fr', padding: '8px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.08em' }}>
          <span>SECTION</span><span>SCORE</span><span>MAX</span><span>FIXES</span>
        </div>
        {breakdown.map(row => (
          <div key={row.section} style={{ display: 'grid', gridTemplateColumns: '140px 60px 60px 1fr', padding: '10px 14px', borderBottom: '1px solid var(--border)', alignItems: 'start', background: row.status === 'fail' ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '8px', color: row.status === 'pass' ? 'var(--green)' : row.status === 'warn' ? 'var(--amber)' : 'var(--red)' }}>
                {row.status === 'pass' ? '●' : row.status === 'warn' ? '◐' : '○'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)' }}>{row.section}</span>
            </div>
            <div>
              <ScoreBar score={row.score} status={row.status} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: row.status === 'pass' ? 'var(--green)' : row.status === 'warn' ? 'var(--amber)' : 'var(--red)', marginTop: '2px' }}>{row.raw}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' }}>{row.max}</div>
            <div>
              {row.fixes.length === 0
                ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>✓ No issues</span>
                : row.fixes.map((f, i) => <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', lineHeight: 1.5 }}>→ {f}</div>)
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Human Score Table ────────────────────────────────────────────────────────
function HumanScoreTable({ checks, result }) {
  const [openSection, setOpenSection] = useState(null);
  const grouped = checks.reduce((acc, c) => {
    if (!acc[c.section]) acc[c.section] = [];
    acc[c.section].push(c);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 500, color: result.totalScore >= 85 ? 'var(--green)' : result.totalScore >= 65 ? 'var(--amber)' : 'var(--red)' }}>
          {result.totalScore}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text3)' }}>/100 human score</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginLeft: '8px', padding: '2px 8px', borderRadius: '3px', background: result.totalScore >= 85 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: result.totalScore >= 85 ? 'var(--green)' : 'var(--amber)' }}>
          {result.verdict}
        </span>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
        {Object.entries(grouped).map(([section, rows]) => {
          const sectionTotal = rows.reduce((s, r) => s + r.score, 0);
          const sectionMax = rows.reduce((s, r) => s + r.max, 0);
          const isOpen = openSection === section;
          return (
            <div key={section} style={{ borderBottom: '1px solid var(--border)' }}>
              <button onClick={() => setOpenSection(isOpen ? null : section)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', flex: 1, letterSpacing: '0.05em' }}>{section}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: sectionTotal / sectionMax >= 0.8 ? 'var(--green)' : sectionTotal / sectionMax >= 0.5 ? 'var(--amber)' : 'var(--red)' }}>
                  {sectionTotal}/{sectionMax}
                </span>
                <ChevronDown size={12} style={{ color: 'var(--text3)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {isOpen && (
                <div style={{ padding: '0 14px 12px' }}>
                  {rows.map(r => (
                    <div key={r.check} style={{ display: 'grid', gridTemplateColumns: '1fr 50px', gap: '8px', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', marginBottom: '2px' }}>{r.check}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: r.status === 'fail' ? 'var(--red)' : r.status === 'warn' ? 'var(--amber)' : 'var(--text3)' }}>
                          {r.reason}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: r.status === 'pass' ? 'var(--green)' : r.status === 'warn' ? 'var(--amber)' : 'var(--red)' }}>
                          {r.score}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>/{r.max}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Small reusable components ────────────────────────────────────────────────
function ScorePill({ label, score, threshold, max }) {
  const passed = threshold ? score >= threshold : null;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: passed === null ? 'var(--text)' : passed ? 'var(--green)' : 'var(--amber)' }}>
        {score}{threshold ? <span style={{ fontSize: '11px', color: 'var(--text3)' }}>/{threshold}</span> : max ? <span style={{ fontSize: '11px', color: 'var(--text3)' }}>/{max}</span> : null}
      </div>
    </div>
  );
}

function ScoreBar({ score, status }) {
  const color = status === 'pass' ? 'var(--green)' : status === 'warn' ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{ width: '36px', height: '4px', background: 'var(--bg3)', borderRadius: '2px' }}>
      <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s' }} />
    </div>
  );
}

function VersionCard({ version, active, onDownload, onDelete }) {
  const date = new Date(version.createdAt).toLocaleDateString();
  return (
    <div style={{
      padding: '10px 12px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: '5px', background: 'var(--bg2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>{date}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={onDownload} style={{ ...ghostBtnStyle, padding: '2px 6px', fontSize: '10px' }}><Download size={10} /></button>
          <button onClick={onDelete} style={{ ...ghostBtnStyle, padding: '2px 6px', fontSize: '10px', color: 'var(--red)' }}><Trash2 size={10} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: version.atsScore >= 90 ? 'var(--green)' : 'var(--amber)' }}>ATS {version.atsScore}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: version.humanScore >= 85 ? 'var(--green)' : 'var(--amber)' }}>H {version.humanScore}</span>
        {version.passed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)' }}>✓ PASS</span>}
      </div>
    </div>
  );
}

function InfoCard({ color, label, text }) {
  return (
    <div style={{ marginBottom: '10px', padding: '10px 12px', border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, borderRadius: '4px', background: 'var(--bg2)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color, marginBottom: '4px', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function ConfigRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: accent ? 'var(--accent)' : 'var(--text)', textAlign: 'right', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text)', maxWidth: '200px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: '10px' }}>
      {children}
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
      <div style={{ marginBottom: '6px', opacity: 0.4, fontSize: '20px' }}>◇</div>
      {msg}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
  );
}

// ─── Shared button styles ────────────────────────────────────────────────────
const primaryBtnStyle = (disabled) => ({
  display: 'flex', alignItems: 'center', gap: '8px',
  background: disabled ? 'var(--bg3)' : 'var(--accent)',
  color: disabled ? 'var(--text3)' : '#000',
  border: 'none', borderRadius: '4px',
  padding: '10px 20px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500,
  letterSpacing: '0.06em', opacity: disabled ? 0.5 : 1,
  transition: 'opacity 0.15s', width: '100%', justifyContent: 'center',
});
const secondaryBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '8px',
  background: 'var(--bg3)', color: 'var(--text2)',
  border: '1px solid var(--border2)', borderRadius: '4px',
  padding: '10px 16px', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '12px',
  letterSpacing: '0.06em', width: '100%', justifyContent: 'center',
};
const ghostBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'none', color: 'var(--text3)',
  border: '1px solid var(--border)', borderRadius: '4px',
  padding: '6px 12px', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '11px',
  letterSpacing: '0.05em',
};
