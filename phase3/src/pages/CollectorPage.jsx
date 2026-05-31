import { useState, useRef, useCallback } from 'react';
import {
  Upload, Link2, X, RefreshCw, Download, ChevronRight,
  CheckCircle, AlertCircle, Clock, Zap, AlertTriangle, Trash2, Eye
} from 'lucide-react';
import { deduplicateUrls, urlToId, extractDomain } from '../utils/dedup';
import { fetchViaJina, sleep, DELAY_MS } from '../utils/jinaFetch';
import { parseJobDescription } from '../utils/jdParser';
import { generateJobsMarkdown, downloadMarkdown } from '../utils/mdExport';
import { saveJob, getAllJobs, deleteJob, clearAllJobs } from '../store/db';
import { getApiKey, getProvider, hasApiKey } from '../store/settings';
import { toast } from '../components/Toast';

const STATUS = {
  QUEUED: 'queued',
  FETCHING: 'fetching',
  PARSING: 'parsing',
  DONE: 'done',
  FALLBACK: 'fallback',
  ERROR: 'error',
};

export default function CollectorPage({ onJobCountChange }) {
  const [rawInput, setRawInput] = useState('');
  const [urlItems, setUrlItems] = useState([]); // { id, url, status, job, error, rawText }
  const [processing, setProcessing] = useState(false);
  const [savedJobs, setSavedJobs] = useState([]);
  const [view, setView] = useState('input'); // 'input' | 'process' | 'saved'
  const [manualFallback, setManualFallback] = useState(null); // { itemId, url }
  const [manualText, setManualText] = useState('');
  const abortRef = useRef(false);

  // Load saved jobs on mount
  useState(() => {
    getAllJobs().then(jobs => {
      setSavedJobs(jobs);
      onJobCountChange?.(jobs.length);
    });
  });

  const updateItem = useCallback((id, updates) => {
    setUrlItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  // ── Step 1: Parse input ──────────────────────────────────────────────────
  const handleParseInput = () => {
    const { unique, duplicates, invalid } = deduplicateUrls(rawInput);

    if (unique.length === 0) {
      toast('No valid URLs found. Check your input.', 'warning');
      return;
    }

    const items = unique.map(url => ({
      id: urlToId(url),
      url,
      domain: extractDomain(url),
      status: STATUS.QUEUED,
      job: null,
      error: null,
      rawText: null,
    }));

    setUrlItems(items);
    setView('process');

    if (duplicates.length > 0) toast(`Removed ${duplicates.length} duplicate URL${duplicates.length > 1 ? 's' : ''}`, 'info');
    if (invalid.length > 0) toast(`Skipped ${invalid.length} invalid URL${invalid.length > 1 ? 's' : ''}`, 'warning');
    toast(`${unique.length} unique URLs ready to process`, 'success');
  };

  // ── Step 2: Process all URLs ─────────────────────────────────────────────
  const handleProcessAll = async () => {
    if (!hasApiKey()) {
      toast('Add your Groq API key in Settings first', 'error');
      return;
    }

    setProcessing(true);
    abortRef.current = false;

    const apiKey = getApiKey();
    const provider = getProvider();

    for (const item of urlItems) {
      if (abortRef.current) break;
      if (item.status === STATUS.DONE) continue;

      // ── Fetch ──
      updateItem(item.id, { status: STATUS.FETCHING });
      const { success, text, error } = await fetchViaJina(item.url);

      if (abortRef.current) break;

      let rawText = text;

      if (!success) {
        // Mark as needing manual fallback
        updateItem(item.id, { status: STATUS.FALLBACK, error });
        await sleep(DELAY_MS);
        continue;
      }

      // ── Parse ──
      updateItem(item.id, { status: STATUS.PARSING, rawText });
      try {
        const parsed = await parseJobDescription(rawText, apiKey, provider);
        const job = {
          id: item.id,
          url: item.url,
          ...parsed,
          status: 'saved',
          createdAt: Date.now(),
        };
        await saveJob(job);
        updateItem(item.id, { status: STATUS.DONE, job });
        setSavedJobs(prev => {
          const next = [...prev.filter(j => j.id !== job.id), job];
          onJobCountChange?.(next.length);
          return next;
        });
      } catch (err) {
        updateItem(item.id, { status: STATUS.ERROR, error: err.message });
        if (err.message.includes('Rate limit')) {
          toast('Rate limit hit — pausing 60s...', 'warning');
          await sleep(60000);
        }
      }

      await sleep(DELAY_MS);
    }

    setProcessing(false);
    const done = urlItems.filter(i => i.status === STATUS.DONE).length;
    toast(`Processing complete — ${done} jobs extracted`, 'success');
  };

  const handleAbort = () => {
    abortRef.current = true;
    setProcessing(false);
    toast('Processing stopped', 'info');
  };

  // ── Manual JD paste for fallback ─────────────────────────────────────────
  const handleManualSubmit = async () => {
    if (!manualText.trim() || !manualFallback) return;
    const apiKey = getApiKey();
    const provider = getProvider();

    updateItem(manualFallback.itemId, { status: STATUS.PARSING, rawText: manualText });
    setManualFallback(null);

    try {
      const parsed = await parseJobDescription(manualText, apiKey, provider);
      const job = {
        id: manualFallback.itemId,
        url: manualFallback.url,
        ...parsed,
        status: 'saved',
        createdAt: Date.now(),
      };
      await saveJob(job);
      updateItem(manualFallback.itemId, { status: STATUS.DONE, job });
      setSavedJobs(prev => {
        const next = [...prev.filter(j => j.id !== job.id), job];
        onJobCountChange?.(next.length);
        return next;
      });
      setManualText('');
      toast('Job extracted from manual paste', 'success');
    } catch (err) {
      updateItem(manualFallback.itemId, { status: STATUS.ERROR, error: err.message });
      toast('Parse failed: ' + err.message, 'error');
    }
  };

  const handleDeleteJob = async (id) => {
    await deleteJob(id);
    setSavedJobs(prev => {
      const next = prev.filter(j => j.id !== id);
      onJobCountChange?.(next.length);
      return next;
    });
    toast('Job removed', 'info');
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear all stored jobs? This cannot be undone.')) return;
    await clearAllJobs();
    setSavedJobs([]);
    onJobCountChange?.(0);
    toast('All jobs cleared', 'info');
  };

  const handleExportMd = () => {
    const md = generateJobsMarkdown(savedJobs);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadMarkdown(md, `jobs_${dateStr}.md`);
    toast(`Exported ${savedJobs.length} jobs as .md`, 'success');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawInput(ev.target.result);
      toast(`Loaded ${file.name}`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const doneCount = urlItems.filter(i => i.status === STATUS.DONE).length;
  const errorCount = urlItems.filter(i => i.status === STATUS.ERROR).length;
  const fallbackCount = urlItems.filter(i => i.status === STATUS.FALLBACK).length;

  return (
    <div style={{ padding: '40px', maxWidth: '860px' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '6px' }}>
          PHASE 1 · JOB LINK COLLECTOR
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: '8px' }}>
          Collect & Extract
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6, maxWidth: '540px' }}>
          Paste job URLs from your daily email alerts. We'll deduplicate, scrape each listing,
          extract structured data, and save everything to your local store.
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '32px' }}>
        {[
          { id: 'input', label: 'INPUT URLS' },
          { id: 'process', label: `PROCESS (${urlItems.length})` },
          { id: 'saved', label: `SAVED JOBS (${savedJobs.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)} style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: view === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: view === tab.id ? 'var(--accent)' : 'var(--text3)',
            marginBottom: '-1px',
            transition: 'color 0.15s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── INPUT VIEW ─────────────────────────────────────────────────────── */}
      {view === 'input' && (
        <div className="fade-in">
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              flex: 1,
              border: '1px solid var(--border)',
              borderRadius: '6px',
              overflow: 'hidden',
              background: 'var(--bg2)',
            }}>
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text3)',
                letterSpacing: '0.08em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
                PASTE JOB URLS · ONE PER LINE · OR COMMA-SEPARATED
              </div>
              <textarea
                value={rawInput}
                onChange={e => setRawInput(e.target.value)}
                placeholder={`https://careers.company.com/job/12345\nhttps://jobs.lever.co/startup/abc\nhttps://greenhouse.io/...`}
                style={{
                  width: '100%',
                  minHeight: '260px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'vertical',
                  padding: '16px',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  lineHeight: 1.7,
                  letterSpacing: '0.02em',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleParseInput} disabled={!rawInput.trim()} style={primaryBtnStyle(!rawInput.trim())}>
              <Zap size={14} />
              PARSE URLS
              <ChevronRight size={14} />
            </button>

            <label style={{
              ...secondaryBtnStyle,
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
            }}>
              <Upload size={14} />
              UPLOAD .TXT / .CSV
              <input type="file" accept=".txt,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

            {rawInput && (
              <button onClick={() => setRawInput('')} style={{ ...ghostBtnStyle, marginLeft: 'auto' }}>
                <X size={13} /> CLEAR
              </button>
            )}
          </div>

          {/* Tips */}
          <div style={{
            marginTop: '28px',
            padding: '16px 20px',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '4px',
            background: 'var(--bg2)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', marginBottom: '10px', letterSpacing: '0.08em' }}>
              HOW IT WORKS
            </div>
            {[
              'URLs are deduplicated by normalized URL — tracking params stripped',
              'Each URL is fetched via Jina Reader (r.jina.ai) — no key required',
              'If a site blocks scraping, you can paste the JD manually',
              'LLM (Groq) extracts: company, role, skills, requirements',
              'All data stored in your browser — no server, no account needed',
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '6px', fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text3)' }}>{String(i + 1).padStart(2, '0')}</span>
                {tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROCESS VIEW ───────────────────────────────────────────────────── */}
      {view === 'process' && (
        <div className="fade-in">
          {/* Stats row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'TOTAL', value: urlItems.length, color: 'var(--text)' },
              { label: 'DONE', value: doneCount, color: 'var(--green)' },
              { label: 'FALLBACK', value: fallbackCount, color: 'var(--amber)' },
              { label: 'ERROR', value: errorCount, color: 'var(--red)' },
            ].map(stat => (
              <div key={stat.label} style={{
                flex: '1', minWidth: '80px',
                padding: '12px 16px',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginBottom: '4px', letterSpacing: '0.1em' }}>
                  {stat.label}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 500, color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {!processing ? (
              <button onClick={handleProcessAll} disabled={urlItems.length === 0} style={primaryBtnStyle(urlItems.length === 0)}>
                <Zap size={14} />
                PROCESS ALL
              </button>
            ) : (
              <button onClick={handleAbort} style={{ ...primaryBtnStyle(false), background: 'var(--red)' }}>
                <X size={14} />
                STOP
              </button>
            )}
            <button onClick={() => setView('input')} style={secondaryBtnStyle}>
              <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
              BACK
            </button>
            {doneCount > 0 && (
              <button onClick={() => setView('saved')} style={{ ...secondaryBtnStyle, marginLeft: 'auto' }}>
                VIEW SAVED →
              </button>
            )}
          </div>

          {/* URL Log Feed */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: '6px',
            overflow: 'hidden',
            background: 'var(--bg)',
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text3)',
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {processing && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1s infinite', display: 'inline-block' }} />}
              PROCESSING LOG
            </div>
            <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
              {urlItems.map((item, idx) => (
                <UrlLogItem
                  key={item.id}
                  item={item}
                  idx={idx}
                  onManualFallback={() => {
                    setManualFallback({ itemId: item.id, url: item.url });
                    setManualText('');
                  }}
                />
              ))}
            </div>
          </div>

          {/* Manual fallback modal */}
          {manualFallback && (
            <div style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '20px',
            }}>
              <div className="fade-in" style={{
                width: '100%', maxWidth: '600px',
                background: 'var(--bg2)',
                border: '1px solid var(--border2)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', marginBottom: '4px', letterSpacing: '0.08em' }}>
                      MANUAL FALLBACK
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text2)' }}>
                      {extractDomain(manualFallback.url)}
                    </div>
                  </div>
                  <button onClick={() => setManualFallback(null)} style={ghostBtnStyle}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text2)', marginBottom: '12px', lineHeight: 1.6 }}>
                    This URL couldn't be scraped automatically. Open the job listing in your browser,
                    select all the text, paste it here:
                  </p>
                  <textarea
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    placeholder="Paste the full job description text here..."
                    autoFocus
                    style={{
                      width: '100%', minHeight: '200px',
                      background: 'var(--bg)', border: '1px solid var(--border2)',
                      borderRadius: '4px', padding: '12px',
                      color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px',
                      outline: 'none', resize: 'vertical', lineHeight: 1.6,
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                    <button onClick={handleManualSubmit} disabled={!manualText.trim()} style={primaryBtnStyle(!manualText.trim())}>
                      <Zap size={13} /> EXTRACT JD
                    </button>
                    <button onClick={() => setManualFallback(null)} style={ghostBtnStyle}>
                      SKIP
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SAVED JOBS VIEW ─────────────────────────────────────────────────── */}
      {view === 'saved' && (
        <div className="fade-in">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
            <button onClick={handleExportMd} disabled={savedJobs.length === 0} style={primaryBtnStyle(savedJobs.length === 0)}>
              <Download size={14} />
              EXPORT AS .MD ({savedJobs.length})
            </button>
            {savedJobs.length > 0 && (
              <button onClick={handleClearAll} style={{ ...ghostBtnStyle, color: 'var(--red)', borderColor: 'var(--red)' }}>
                <Trash2 size={13} /> CLEAR ALL
              </button>
            )}
          </div>

          {savedJobs.length === 0 ? (
            <EmptyState message="No jobs saved yet. Process some URLs first." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...savedJobs].sort((a, b) => b.createdAt - a.createdAt).map(job => (
                <JobCard key={job.id} job={job} onDelete={handleDeleteJob} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UrlLogItem({ item, idx, onManualFallback }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    [STATUS.QUEUED]:   { color: 'var(--text3)', icon: <Clock size={12} />, label: 'QUEUED' },
    [STATUS.FETCHING]: { color: 'var(--blue)', icon: <Spinner />, label: 'FETCHING' },
    [STATUS.PARSING]:  { color: 'var(--accent)', icon: <Spinner />, label: 'PARSING' },
    [STATUS.DONE]:     { color: 'var(--green)', icon: <CheckCircle size={12} />, label: 'DONE' },
    [STATUS.FALLBACK]: { color: 'var(--amber)', icon: <AlertTriangle size={12} />, label: 'BLOCKED' },
    [STATUS.ERROR]:    { color: 'var(--red)', icon: <AlertCircle size={12} />, label: 'ERROR' },
  };

  const s = statusConfig[item.status] || statusConfig[STATUS.QUEUED];

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '10px 14px',
      animation: 'slideIn 0.2s ease forwards',
      animationDelay: `${idx * 0.03}s`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', minWidth: '22px' }}>
          {String(idx + 1).padStart(2, '0')}
        </span>
        <span style={{ color: s.color, display: 'flex', alignItems: 'center' }}>{s.icon}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: s.color, minWidth: '60px', letterSpacing: '0.06em' }}>
          {s.label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.domain}
        </span>
        {item.status === STATUS.DONE && item.job && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.job.company} · {item.job.role}
          </span>
        )}
        {item.status === STATUS.FALLBACK && (
          <button onClick={onManualFallback} style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)',
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.05em',
          }}>
            PASTE JD
          </button>
        )}
        {item.status === STATUS.ERROR && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.error}
          </span>
        )}
        {item.status === STATUS.DONE && (
          <button onClick={() => setExpanded(e => !e)} style={{ ...ghostBtnStyle, padding: '2px 6px', fontSize: '10px' }}>
            <Eye size={11} />
          </button>
        )}
      </div>
      {expanded && item.job && (
        <div className="fade-in" style={{
          marginTop: '10px', marginLeft: '32px',
          padding: '12px', background: 'var(--bg2)',
          borderRadius: '4px', border: '1px solid var(--border)',
        }}>
          <JobMiniDetail job={item.job} />
        </div>
      )}
    </div>
  );
}

function JobMiniDetail({ job }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: 1.7 }}>
      <div><span style={{ color: 'var(--text3)' }}>Company  </span><span style={{ color: 'var(--text)' }}>{job.company}</span></div>
      <div><span style={{ color: 'var(--text3)' }}>Role     </span><span style={{ color: 'var(--text)' }}>{job.role}</span></div>
      <div><span style={{ color: 'var(--text3)' }}>Level    </span><span style={{ color: 'var(--accent)' }}>{job.seniority}</span></div>
      <div><span style={{ color: 'var(--text3)' }}>Location </span><span style={{ color: 'var(--text2)' }}>{job.location}</span></div>
      {job.mustHaveSkills?.length > 0 && (
        <div style={{ marginTop: '6px' }}>
          <span style={{ color: 'var(--text3)' }}>Must-have </span>
          <span style={{ color: 'var(--green)' }}>{job.mustHaveSkills.slice(0, 6).join(', ')}</span>
        </div>
      )}
      {job.summary && (
        <div style={{ marginTop: '6px', color: 'var(--text2)', lineHeight: 1.5, maxWidth: '500px' }}>{job.summary}</div>
      )}
    </div>
  );
}

function JobCard({ job, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(job.createdAt).toLocaleDateString();

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '6px',
      overflow: 'hidden',
      background: 'var(--bg2)',
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {job.company}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>·</span>
            <span style={{ fontSize: '13px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
              {job.role}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[job.seniority, job.location, job.domain].filter(v => v && v !== 'unknown').map(tag => (
              <span key={tag} style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                color: 'var(--text3)', background: 'var(--bg3)',
                padding: '2px 8px', borderRadius: '3px',
                border: '1px solid var(--border)',
              }}>{tag}</span>
            ))}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginLeft: 'auto' }}>
              {date}
            </span>
          </div>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text3)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>

      {expanded && (
        <div className="fade-in" style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ paddingTop: '12px' }}>
            {job.summary && <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '12px' }}>{job.summary}</p>}
            {job.mustHaveSkills?.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '6px', letterSpacing: '0.08em' }}>MUST-HAVE SKILLS</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {job.mustHaveSkills.map(s => (
                    <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'rgba(34,197,94,0.1)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)', padding: '2px 8px', borderRadius: '3px' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {job.niceToHaveSkills?.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '6px', letterSpacing: '0.08em' }}>NICE-TO-HAVE</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {job.niceToHaveSkills.map(s => (
                    <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'rgba(212,160,23,0.1)', color: 'var(--accent)', border: '1px solid rgba(212,160,23,0.2)', padding: '2px 8px', borderRadius: '3px' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {job.keyRequirements?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '6px', letterSpacing: '0.08em' }}>KEY REQUIREMENTS</div>
                {job.keyRequirements.map((r, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', padding: '2px 0', display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--text3)' }}>→</span> {r}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <a href={job.url} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--blue)', textDecoration: 'none' }}>
                OPEN ORIGINAL ↗
              </a>
              <button onClick={() => onDelete(job.id)} style={{ ...ghostBtnStyle, marginLeft: 'auto', color: 'var(--red)', borderColor: 'transparent', fontSize: '10px' }}>
                <Trash2 size={11} /> REMOVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{
      padding: '60px 20px',
      textAlign: 'center',
      border: '1px dashed var(--border)',
      borderRadius: '8px',
      color: 'var(--text3)',
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
    }}>
      <div style={{ marginBottom: '8px', fontSize: '24px', opacity: 0.4 }}>◇</div>
      {message}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: '12px', height: '12px',
      border: '1.5px solid currentColor',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
    }} />
  );
}

// ── Button styles ─────────────────────────────────────────────────────────────
const primaryBtnStyle = (disabled) => ({
  display: 'flex', alignItems: 'center', gap: '8px',
  background: disabled ? 'var(--bg3)' : 'var(--accent)',
  color: disabled ? 'var(--text3)' : '#000',
  border: 'none', borderRadius: '4px',
  padding: '10px 20px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500,
  letterSpacing: '0.06em', opacity: disabled ? 0.5 : 1,
  transition: 'opacity 0.15s',
});

const secondaryBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '8px',
  background: 'var(--bg3)',
  color: 'var(--text2)',
  border: '1px solid var(--border2)',
  borderRadius: '4px',
  padding: '10px 16px',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '12px',
  letterSpacing: '0.06em',
  transition: 'color 0.15s',
};

const ghostBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'none',
  color: 'var(--text3)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  padding: '6px 12px',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '11px',
  letterSpacing: '0.05em',
  transition: 'color 0.15s',
};
