import { useState, useEffect, useMemo } from 'react';
import { BarChart2, ChevronDown, ChevronRight, AlertCircle, CheckCircle, AlertTriangle, RefreshCw, FileText } from 'lucide-react';
import { analyseResume, annotateBullets } from '../utils/sectionAnalyser.js';
import { scoreATS, getSectionBreakdown } from '../utils/atsScorer.js';
import { getAllTailoredResumes } from '../store/resumeStore.js';
import { getAllJobs } from '../store/db.js';
import { getBaseResume } from '../store/resumeStore.js';

// ── colour helpers ───────────────────────────────────────────────────────────
const statusColor = s => s === 'pass' ? 'var(--green)' : s === 'warn' ? 'var(--amber)' : 'var(--red)';
const statusBg   = s => s === 'pass' ? 'rgba(34,197,94,0.08)' : s === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
const gradeColor  = g => g === 'strong' ? 'var(--green)' : g === 'ok' ? 'var(--amber)' : 'var(--red)';

export default function AnalyserPage() {
  const [versions, setVersions]         = useState([]);
  const [jobs, setJobs]                 = useState([]);
  const [baseResume, setBaseResume]     = useState(null);
  const [selectedId, setSelectedId]     = useState('base');
  const [activeSection, setActiveSection] = useState(null);
  const [mainTab, setMainTab]           = useState('overview');  // overview | sections | bullets | compare
  const [compareId, setCompareId]       = useState(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    Promise.all([getAllTailoredResumes(), getAllJobs(), getBaseResume()]).then(([vs, js, base]) => {
      setVersions(vs.sort((a, b) => b.createdAt - a.createdAt));
      setJobs(js);
      setBaseResume(base);
      if (vs.length > 0) setSelectedId(vs[0].id);
      else if (base) setSelectedId('base');
      setLoading(false);
    });
  }, []);

  // Build the selected version's analysis
  const selected = useMemo(() => {
    if (selectedId === 'base') {
      if (!baseResume?.raw) return null;
      return { id: 'base', resumeMarkdown: baseResume.raw, label: 'Base Resume', jobId: null, atsScore: null, humanScore: null };
    }
    return versions.find(v => v.id === selectedId) || null;
  }, [selectedId, versions, baseResume]);

  const jobForSelected = useMemo(() => {
    if (!selected?.jobId) return null;
    return jobs.find(j => j.id === selected.jobId);
  }, [selected, jobs]);

  const analysis = useMemo(() => {
    if (!selected?.resumeMarkdown) return null;
    return analyseResume(selected.resumeMarkdown, jobForSelected || {});
  }, [selected, jobForSelected]);

  const atsBreakdown = useMemo(() => {
    if (!selected?.resumeMarkdown) return [];
    return getSectionBreakdown(selected.resumeMarkdown, jobForSelected || {});
  }, [selected, jobForSelected]);

  // Compare version analysis
  const compareVersion = useMemo(() => versions.find(v => v.id === compareId), [compareId, versions]);
  const compareAnalysis = useMemo(() => {
    if (!compareVersion?.resumeMarkdown) return null;
    const job = jobs.find(j => j.id === compareVersion.jobId);
    return analyseResume(compareVersion.resumeMarkdown, job || {});
  }, [compareVersion, jobs]);

  if (loading) return <LoadingState />;

  if (!selected && !baseResume) {
    return (
      <div style={{ padding: '40px' }}>
        <PageHeader />
        <Empty msg="No resumes to analyse yet. Go to Tailor to generate tailored versions, or upload your base resume first." />
      </div>
    );
  }

  const versionOptions = [
    ...(baseResume?.raw ? [{ id: 'base', label: 'Base Resume', atsScore: null, humanScore: null }] : []),
    ...versions.map(v => {
      const job = jobs.find(j => j.id === v.jobId);
      return { id: v.id, label: `${job?.company || '?'} — ${job?.role || '?'}`, atsScore: v.atsScore, humanScore: v.humanScore, createdAt: v.createdAt };
    }),
  ];

  return (
    <div style={{ padding: '40px', maxWidth: '1060px' }}>
      <PageHeader />

      {/* Version selector bar */}
      <div style={{
        display: 'flex', gap: '10px', alignItems: 'center',
        padding: '14px 16px', background: 'var(--bg2)',
        border: '1px solid var(--border)', borderRadius: '8px',
        marginBottom: '24px', flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', flexShrink: 0 }}>ANALYSE:</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
          {versionOptions.map(v => (
            <button key={v.id} onClick={() => setSelectedId(v.id)} style={{
              padding: '5px 12px', border: `1px solid ${selectedId === v.id ? 'var(--accent)' : 'var(--border)'}`,
              background: selectedId === v.id ? 'rgba(212,160,23,0.1)' : 'var(--bg3)',
              borderRadius: '4px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: selectedId === v.id ? 'var(--accent)' : 'var(--text2)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              {v.label}
              {v.atsScore != null && (
                <span style={{ fontSize: '9px', color: v.atsScore >= 90 ? 'var(--green)' : 'var(--amber)' }}>
                  ATS {v.atsScore}
                </span>
              )}
            </button>
          ))}
        </div>
        {analysis && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>OVERALL</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600,
              color: analysis.overallScore >= 80 ? 'var(--green)' : analysis.overallScore >= 60 ? 'var(--amber)' : 'var(--red)',
            }}>{analysis.overallScore}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '2px 7px', borderRadius: '3px',
              background: analysis.overallScore >= 80 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
              color: analysis.overallScore >= 80 ? 'var(--green)' : 'var(--amber)',
            }}>{analysis.overallGrade}</span>
          </div>
        )}
      </div>

      {analysis && (
        <>
          {/* Main tab strip */}
          <TabStrip tabs={[
            { id: 'overview',  label: 'OVERVIEW' },
            { id: 'sections',  label: 'SECTIONS' },
            { id: 'bullets',   label: `BULLETS (${analysis.bullets.total})` },
            { id: 'compare',   label: 'COMPARE' },
          ]} active={mainTab} onChange={setMainTab} />

          <div style={{ marginTop: '24px' }}>
            {mainTab === 'overview'  && <OverviewTab analysis={analysis} atsBreakdown={atsBreakdown} selected={selected} jobForSelected={jobForSelected} />}
            {mainTab === 'sections'  && <SectionsTab analysis={analysis} activeSection={activeSection} onSectionClick={setActiveSection} />}
            {mainTab === 'bullets'   && <BulletsTab analysis={analysis} />}
            {mainTab === 'compare'   && (
              <CompareTab
                current={{ analysis, version: selected, job: jobForSelected }}
                versions={versionOptions.filter(v => v.id !== selectedId && v.id !== 'base')}
                compareId={compareId}
                onCompareSelect={setCompareId}
                compareAnalysis={compareAnalysis}
                compareVersion={compareVersion}
                compareJob={jobs.find(j => j.id === compareVersion?.jobId)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ analysis, atsBreakdown, selected, jobForSelected }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      {/* Radar chart */}
      <div>
        <SectionLabel>SECTION HEALTH RADAR</SectionLabel>
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg2)', padding: '20px', display: 'flex', justifyContent: 'center' }}>
          <RadarChart sections={analysis.sectionList} />
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <SectionLabel>KEY METRICS</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <MetricCard label="Overall" value={analysis.overallScore} suffix="/100" color={analysis.overallScore >= 80 ? 'var(--green)' : 'var(--amber)'} />
          <MetricCard label="Total Bullets" value={analysis.bullets.total} color="var(--text)" />
          <MetricCard label="Metric Rate" value={`${analysis.bullets.metricRate}%`} color={analysis.bullets.metricRate >= 70 ? 'var(--green)' : 'var(--amber)'} />
          <MetricCard label="Strong Verb Rate" value={`${analysis.bullets.strongRate}%`} color={analysis.bullets.strongRate >= 70 ? 'var(--green)' : 'var(--amber)'} />
          <MetricCard label="Weak Bullets" value={analysis.bullets.weak} color={analysis.bullets.weak === 0 ? 'var(--green)' : 'var(--red)'} />
          <MetricCard label="Word Count" value={analysis.wordCount} color="var(--text)" />
        </div>

        {/* Weakest / Strongest */}
        <SectionLabel>PRIORITY FIXES</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {analysis.weakestSections.map(s => (
            <div key={s.section} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: statusBg(s.status), border: `1px solid ${statusColor(s.status)}33`, borderRadius: '6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: statusColor(s.status), minWidth: '80px' }}>{s.section}</span>
              <HBar score={s.score} color={statusColor(s.status)} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: statusColor(s.status), minWidth: '32px' }}>{s.score}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.fixes[0] || '—'}
              </span>
            </div>
          ))}
        </div>

        {/* ATS section breakdown quick view */}
        <SectionLabel>ATS RULE ENGINE SCORES</SectionLabel>
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          {atsBreakdown.map((row, i) => (
            <div key={row.section} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 14px', borderBottom: i < atsBreakdown.length - 1 ? '1px solid var(--border)' : 'none',
              background: row.status === 'fail' ? 'rgba(239,68,68,0.03)' : 'transparent',
            }}>
              <span style={{ fontSize: '8px', color: statusColor(row.status) }}>
                {row.status === 'pass' ? '●' : row.status === 'warn' ? '◐' : '○'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', minWidth: '110px' }}>{row.section}</span>
              <HBar score={row.score} color={statusColor(row.status)} width={80} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: statusColor(row.status), minWidth: '28px' }}>{row.raw}/{row.max}</span>
              {row.fixes.length > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  → {row.fixes[0]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sections tab ──────────────────────────────────────────────────────────────
function SectionsTab({ analysis, activeSection, onSectionClick }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px' }}>
      {/* Section list */}
      <div>
        <SectionLabel>SECTIONS</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {analysis.sectionList.map(s => (
            <button key={s.section} onClick={() => onSectionClick(activeSection === s.section ? null : s.section)} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px',
              background: activeSection === s.section ? statusBg(s.status) : 'var(--bg2)',
              border: `1px solid ${activeSection === s.section ? statusColor(s.status) + '55' : 'var(--border)'}`,
              borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: '9px', color: statusColor(s.status) }}>
                {s.status === 'pass' ? '●' : s.status === 'warn' ? '◐' : '○'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', flex: 1 }}>{s.section}</span>
              <ScoreBadge score={s.score} status={s.status} />
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div>
        {!activeSection ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <div style={{ fontSize: '20px', opacity: 0.4, marginBottom: '8px' }}>◈</div>
            Click a section to see its detailed analysis
          </div>
        ) : (() => {
          const s = analysis.sectionList.find(x => x.section === activeSection);
          if (!s) return null;
          return (
            <div className="fade-in">
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '14px 16px', background: statusBg(s.status), border: `1px solid ${statusColor(s.status)}33`, borderRadius: '8px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{s.section}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 600, color: statusColor(s.status), marginLeft: 'auto' }}>{s.score}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: statusColor(s.status), padding: '2px 8px', background: statusBg(s.status), borderRadius: '3px', border: `1px solid ${statusColor(s.status)}44` }}>
                  {s.status.toUpperCase()}
                </span>
              </div>

              {/* Checks */}
              <SectionLabel>CHECKLIST</SectionLabel>
              <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
                {(s.checks || []).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderBottom: i < s.checks.length - 1 ? '1px solid var(--border)' : 'none', background: c.pass ? 'transparent' : 'rgba(239,68,68,0.03)' }}>
                    <span style={{ color: c.pass ? 'var(--green)' : 'var(--red)', fontSize: '13px', flexShrink: 0 }}>{c.pass ? '✓' : '✗'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: c.pass ? 'var(--text2)' : 'var(--text)' }}>{c.label}</span>
                  </div>
                ))}
              </div>

              {/* Fixes */}
              {s.fixes?.length > 0 && (
                <>
                  <SectionLabel>ACTION ITEMS</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    {s.fixes.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '3px solid var(--amber)', borderRadius: '4px' }}>
                        <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: '11px', flexShrink: 0 }}>→</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text2)', lineHeight: 1.5 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Bullet breakdown if section has bullets */}
              {(s.details?.bullets?.length > 0) && (
                <>
                  <SectionLabel>BULLET ANALYSIS ({s.details.bullets.length} bullets)</SectionLabel>
                  <BulletList bullets={s.details.bullets} />
                </>
              )}

              {/* Skills keyword match detail */}
              {s.section === 'Skills' && s.details?.mustHaveMissing?.length > 0 && (
                <>
                  <SectionLabel>MISSING JD KEYWORDS</SectionLabel>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {s.details.mustHaveMissing.map(k => (
                      <span key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '3px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '3px', color: 'var(--red)' }}>
                        {k}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Bullets tab ───────────────────────────────────────────────────────────────
function BulletsTab({ analysis }) {
  const [filter, setFilter] = useState('all'); // all | weak | ok | strong
  const allBullets = analysis.bullets.all;
  const filtered = filter === 'all' ? allBullets : allBullets.filter(b => b.grade === filter);

  const countByGrade = {
    strong: allBullets.filter(b => b.grade === 'strong').length,
    ok:     allBullets.filter(b => b.grade === 'ok').length,
    weak:   allBullets.filter(b => b.grade === 'weak').length,
  };

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { key: 'all',    label: 'ALL',    count: allBullets.length, color: 'var(--text)' },
          { key: 'strong', label: 'STRONG', count: countByGrade.strong, color: 'var(--green)' },
          { key: 'ok',     label: 'OK',     count: countByGrade.ok, color: 'var(--amber)' },
          { key: 'weak',   label: 'WEAK',   count: countByGrade.weak, color: 'var(--red)' },
        ].map(b => (
          <button key={b.key} onClick={() => setFilter(b.key)} style={{
            padding: '12px', border: `1px solid ${filter === b.key ? b.color : 'var(--border)'}`,
            background: filter === b.key ? `${b.color}11` : 'var(--bg2)',
            borderRadius: '6px', cursor: 'pointer', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 600, color: b.color }}>{b.count}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: filter === b.key ? b.color : 'var(--text3)', letterSpacing: '0.1em', marginTop: '2px' }}>{b.label}</div>
          </button>
        ))}
      </div>

      {/* Bullet list */}
      {filtered.length === 0
        ? <Empty msg={`No ${filter} bullets.`} />
        : <BulletList bullets={filtered} showScore />
      }
    </div>
  );
}

// ── Compare tab ───────────────────────────────────────────────────────────────
function CompareTab({ current, versions, compareId, onCompareSelect, compareAnalysis, compareVersion, compareJob }) {
  if (versions.length === 0) {
    return <Empty msg="No other versions to compare. Generate more tailored resumes to unlock comparison." />;
  }

  return (
    <div>
      {/* Picker */}
      <div style={{ marginBottom: '20px' }}>
        <SectionLabel>COMPARE WITH</SectionLabel>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {versions.map(v => (
            <button key={v.id} onClick={() => onCompareSelect(v.id)} style={{
              padding: '6px 14px', border: `1px solid ${compareId === v.id ? 'var(--accent)' : 'var(--border)'}`,
              background: compareId === v.id ? 'rgba(212,160,23,0.1)' : 'var(--bg2)',
              borderRadius: '4px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: compareId === v.id ? 'var(--accent)' : 'var(--text2)',
            }}>
              {v.label}
              {v.atsScore != null && <span style={{ marginLeft: '6px', fontSize: '9px', color: v.atsScore >= 90 ? 'var(--green)' : 'var(--amber)' }}>ATS {v.atsScore}</span>}
            </button>
          ))}
        </div>
      </div>

      {!compareAnalysis ? (
        <Empty msg="Select a version above to compare." />
      ) : (
        <CompareGrid left={current} right={{ analysis: compareAnalysis, version: compareVersion, job: compareJob }} />
      )}
    </div>
  );
}

function CompareGrid({ left, right }) {
  const sections = left.analysis.sectionList.map(s => s.section);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '1px', marginBottom: '2px' }}>
        <div />
        <div style={{ padding: '8px 12px', background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.25)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', letterSpacing: '0.08em', textAlign: 'center' }}>
          CURRENT · {left.job?.company || 'Base'} {left.job?.role || ''}
        </div>
        <div style={{ padding: '8px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.08em', textAlign: 'center' }}>
          {right.job?.company || '?'} — {right.job?.role || '?'}
        </div>
      </div>

      {/* Overall row */}
      <CompareRow
        label="Overall"
        leftVal={left.analysis.overallScore}
        rightVal={right.analysis.overallScore}
        isScore
      />

      {/* Bullet metrics */}
      <CompareRow label="Metric Rate"  leftVal={`${left.analysis.bullets.metricRate}%`}  rightVal={`${right.analysis.bullets.metricRate}%`}  leftNum={left.analysis.bullets.metricRate}  rightNum={right.analysis.bullets.metricRate} />
      <CompareRow label="Strong Verbs" leftVal={`${left.analysis.bullets.strongRate}%`}  rightVal={`${right.analysis.bullets.strongRate}%`}  leftNum={left.analysis.bullets.strongRate}  rightNum={right.analysis.bullets.strongRate} />
      <CompareRow label="Weak Bullets" leftVal={left.analysis.bullets.weak}  rightVal={right.analysis.bullets.weak}  leftNum={100 - left.analysis.bullets.weak * 10}  rightNum={100 - right.analysis.bullets.weak * 10} invertWin />

      {/* Per-section scores */}
      {sections.map(sec => {
        const ls = left.analysis.sectionList.find(s => s.section === sec);
        const rs = right.analysis.sectionList.find(s => s.section === sec);
        if (!ls || !rs) return null;
        return (
          <CompareRow key={sec} label={sec} leftVal={ls.score} rightVal={rs.score} isScore />
        );
      })}
    </div>
  );
}

function CompareRow({ label, leftVal, rightVal, leftNum, rightNum, isScore, invertWin }) {
  const lNum = isScore ? leftVal : (leftNum ?? 0);
  const rNum = isScore ? rightVal : (rightNum ?? 0);
  const leftWins  = invertWin ? lNum < rNum : lNum > rNum;
  const rightWins = invertWin ? rNum < lNum : rNum > lNum;

  const cellStyle = (wins) => ({
    padding: '10px 14px', textAlign: 'center',
    fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 500,
    color: wins ? 'var(--green)' : 'var(--text2)',
    background: wins ? 'rgba(34,197,94,0.06)' : 'transparent',
    border: '1px solid var(--border)', borderRadius: '4px',
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '4px', marginBottom: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)', paddingLeft: '4px' }}>{label}</div>
      <div style={cellStyle(leftWins)}>
        {leftVal}{isScore && <span style={{ fontSize: '10px', color: 'var(--text3)' }}>/100</span>}
        {leftWins && <span style={{ marginLeft: '6px', fontSize: '10px' }}>▲</span>}
      </div>
      <div style={cellStyle(rightWins)}>
        {rightVal}{isScore && <span style={{ fontSize: '10px', color: 'var(--text3)' }}>/100</span>}
        {rightWins && <span style={{ marginLeft: '6px', fontSize: '10px' }}>▲</span>}
      </div>
    </div>
  );
}

// ── Radar Chart (pure SVG, no deps) ──────────────────────────────────────────
function RadarChart({ sections }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const R = 90;
  const levels = 4;

  const pts = sections.map((s, i) => {
    const angle = (i / sections.length) * 2 * Math.PI - Math.PI / 2;
    return { angle, label: s.section, score: s.score, status: s.status };
  });

  const toXY = (angle, r) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  // Grid polygons
  const gridPolygons = Array.from({ length: levels }, (_, l) => {
    const r = R * ((l + 1) / levels);
    return pts.map(p => toXY(p.angle, r)).map(({ x, y }) => `${x},${y}`).join(' ');
  });

  // Data polygon
  const dataPoints = pts.map(p => {
    const r = R * (p.score / 100);
    return toXY(p.angle, r);
  });
  const dataPolygon = dataPoints.map(({ x, y }) => `${x},${y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size + 20}`} width={size} height={size + 20} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {gridPolygons.map((poly, i) => (
        <polygon key={i} points={poly} fill="none" stroke="var(--border2)" strokeWidth="0.5" />
      ))}

      {/* Axis lines */}
      {pts.map((p, i) => {
        const end = toXY(p.angle, R);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="var(--border2)" strokeWidth="0.5" />;
      })}

      {/* Score % labels on outermost ring */}
      {[25, 50, 75, 100].map((pct, i) => {
        const r = R * (pct / 100);
        const pos = toXY(-Math.PI / 2, r);
        return (
          <text key={pct} x={pos.x + 3} y={pos.y} fontFamily="var(--font-mono)" fontSize="7" fill="var(--text3)">{pct}</text>
        );
      })}

      {/* Data fill polygon */}
      <polygon
        points={dataPolygon}
        fill="rgba(212,160,23,0.15)"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {dataPoints.map(({ x, y }, i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="var(--accent)" />
      ))}

      {/* Labels */}
      {pts.map((p, i) => {
        const labelR = R + 22;
        const pos = toXY(p.angle, labelR);
        const anchor = pos.x < cx - 5 ? 'end' : pos.x > cx + 5 ? 'start' : 'middle';
        const color = statusColor(p.status);
        return (
          <g key={i}>
            <text
              x={pos.x} y={pos.y - 4}
              textAnchor={anchor}
              fontFamily="var(--font-mono)"
              fontSize="9"
              fill="var(--text2)"
            >
              {p.label}
            </text>
            <text
              x={pos.x} y={pos.y + 7}
              textAnchor={anchor}
              fontFamily="var(--font-mono)"
              fontSize="9"
              fontWeight="600"
              fill={color}
            >
              {p.score}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Bullet list component ────────────────────────────────────────────────────
function BulletList({ bullets, showScore = false }) {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
      {bullets.map((b, i) => (
        <div key={i} style={{ borderBottom: i < bullets.length - 1 ? '1px solid var(--border)' : 'none', background: b.grade === 'weak' ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
          {/* Bullet row */}
          <div
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', cursor: 'pointer' }}
          >
            {/* Grade dot */}
            <span style={{ fontSize: '8px', color: gradeColor(b.grade), marginTop: '4px', flexShrink: 0 }}>
              {b.grade === 'strong' ? '●' : b.grade === 'ok' ? '◐' : '○'}
            </span>
            {/* Bullet text */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', flex: 1, lineHeight: 1.6 }}>
              {b.text}
            </span>
            {/* Inline flags */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
              {b.hasMetric    && <Tag label="M" color="var(--green)"  title="Has metric" />}
              {b.hasStrongVerb && <Tag label="V" color="var(--blue)"  title="Strong verb" />}
              {b.hasBannedVerb && <Tag label="!" color="var(--red)"   title="Banned verb" />}
              {!b.hasMetric    && <Tag label="M?" color="var(--red)"  title="No metric" />}
              {showScore && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: gradeColor(b.grade), minWidth: '28px', textAlign: 'right' }}>{b.score}</span>
              )}
              <ChevronDown size={12} style={{ color: 'var(--text3)', transform: openIdx === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
          </div>
          {/* Expanded issues */}
          {openIdx === i && b.issues.length > 0 && (
            <div className="fade-in" style={{ padding: '6px 14px 12px 34px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {b.issues.map((issue, j) => (
                <div key={j} style={{ display: 'flex', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--amber)', flexShrink: 0 }}>→</span>
                  {issue}
                </div>
              ))}
            </div>
          )}
          {openIdx === i && b.issues.length === 0 && (
            <div style={{ padding: '6px 14px 12px 34px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)' }}>
              ✓ No issues found
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Small reusable parts ──────────────────────────────────────────────────────
function PageHeader() {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '6px' }}>
        PHASE 3 · SECTION ANALYSER
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '6px' }}>
        Deep Analyser
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6, maxWidth: '560px' }}>
        Section-by-section breakdown of every resume version. Bullet-level annotations, keyword gaps,
        radar health chart, and side-by-side version comparison.
      </p>
    </div>
  );
}

function TabStrip({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '0' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '9px 18px', background: 'none', border: 'none',
          borderBottom: active === t.id ? '2px solid var(--accent)' : '2px solid transparent',
          cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px',
          letterSpacing: '0.08em', color: active === t.id ? 'var(--accent)' : 'var(--text3)',
          marginBottom: '-1px', transition: 'color 0.15s',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: '8px' }}>{children}</div>;
}

function MetricCard({ label, value, suffix = '', color }) {
  return (
    <div style={{ padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, color }}>{value}{suffix}</div>
    </div>
  );
}

function ScoreBadge({ score, status }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600,
      color: statusColor(status), minWidth: '28px', textAlign: 'right',
    }}>{score}</span>
  );
}

function HBar({ score, color, width = 100 }) {
  return (
    <div style={{ flex: 1, maxWidth: width, height: '4px', background: 'var(--bg3)', borderRadius: '2px' }}>
      <div style={{ width: `${Math.min(100, score)}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
    </div>
  );
}

function Tag({ label, color, title }) {
  return (
    <span title={title} style={{
      fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 600,
      color, background: `${color}18`, border: `1px solid ${color}44`,
      padding: '1px 5px', borderRadius: '3px',
    }}>{label}</span>
  );
}

function Empty({ msg }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
      <div style={{ fontSize: '20px', opacity: 0.4, marginBottom: '8px' }}>◇</div>
      {msg}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: '40px', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text3)' }}>
      <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      Loading resume data...
    </div>
  );
}
