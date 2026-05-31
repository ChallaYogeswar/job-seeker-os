import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, X, ExternalLink, Trash2, Download, ChevronDown,
  ChevronRight, Clock, CheckCircle, AlertCircle, Calendar,
  FileText, BarChart2, StickyNote, User, DollarSign, Activity,
} from 'lucide-react';
import {
  getAllApplications, saveApplication, updateApplicationStatus,
  updateApplication, deleteApplication, createApplication,
  exportApplicationsCSV, APP_STATUSES, STATUS_META,
} from '../store/applicationStore.js';
import { getAllJobs } from '../store/db.js';
import { getAllTailoredResumes } from '../store/resumeStore.js';
import { toast } from '../components/Toast.jsx';

export default function TrackerPage() {
  const [apps, setApps]               = useState([]);
  const [jobs, setJobs]               = useState([]);
  const [versions, setVersions]       = useState([]);
  const [drawerApp, setDrawerApp]     = useState(null);   // app open in detail drawer
  const [addModalJob, setAddModalJob] = useState(null);   // job selected for new app
  const [showAddModal, setShowAddModal] = useState(false);
  const [dragId, setDragId]           = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [loading, setLoading]         = useState(true);

  // Load everything
  useEffect(() => {
    Promise.all([getAllApplications(), getAllJobs(), getAllTailoredResumes()])
      .then(([a, j, v]) => {
        setApps(a);
        setJobs(j.sort((x, y) => y.createdAt - x.createdAt));
        setVersions(v);
        setLoading(false);
      });
  }, []);

  // Keep drawer in sync when apps update
  useEffect(() => {
    if (drawerApp) {
      const updated = apps.find(a => a.id === drawerApp.id);
      if (updated) setDrawerApp(updated);
    }
  }, [apps]);

  const appsByStatus = useCallback((status) =>
    apps.filter(a => a.status === status).sort((a, b) => b.updatedAt - a.updatedAt),
  [apps]);

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Ghost image
    const el = e.currentTarget;
    el.style.opacity = '0.5';
    setTimeout(() => { el.style.opacity = '1'; }, 0);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(status);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!dragId) return;
    const app = apps.find(a => a.id === dragId);
    if (!app || app.status === targetStatus) { setDragId(null); return; }

    const updated = await updateApplicationStatus(dragId, targetStatus);
    setApps(prev => prev.map(a => a.id === dragId ? updated : a));

    // Auto-set appliedDate when moved to Applied
    if (targetStatus === 'applied' && !app.appliedDate) {
      const withDate = await updateApplication(dragId, { appliedDate: Date.now() });
      setApps(prev => prev.map(a => a.id === dragId ? withDate : a));
    }

    toast(`Moved to ${STATUS_META[targetStatus].label}`, 'success');
    setDragId(null);
  };

  const handleDragEnd = () => { setDragId(null); setDragOverCol(null); };

  // ── Add application ────────────────────────────────────────────────────────
  const handleCreateApp = async (job, resumeVersion) => {
    const newApp = createApplication({ job, resumeVersion });
    await saveApplication(newApp);
    setApps(prev => [newApp, ...prev]);
    setShowAddModal(false);
    toast(`Added ${job.company} — ${job.role} to Saved`, 'success');
  };

  // ── Update helpers ─────────────────────────────────────────────────────────
  const handleUpdateField = async (id, field, value) => {
    const updated = await updateApplication(id, { [field]: value });
    if (updated) setApps(prev => prev.map(a => a.id === id ? updated : a));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this application?')) return;
    await deleteApplication(id);
    setApps(prev => prev.filter(a => a.id !== id));
    if (drawerApp?.id === id) setDrawerApp(null);
    toast('Application removed', 'info');
  };

  const handleExportCSV = () => {
    const csv = exportApplicationsCSV(apps);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `applications_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${apps.length} applications`, 'success');
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:     apps.length,
    applied:   apps.filter(a => a.status === 'applied').length,
    interview: apps.filter(a => a.status === 'interview').length,
    offer:     apps.filter(a => a.status === 'offer').length,
    rejected:  apps.filter(a => a.status === 'rejected').length,
    conversionRate: apps.length > 0
      ? Math.round((apps.filter(a => ['interview','offer'].includes(a.status)).length / Math.max(apps.filter(a => a.status !== 'saved').length, 1)) * 100)
      : 0,
  };

  if (loading) return (
    <div style={{ padding: '40px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <Spinner /> Loading tracker...
    </div>
  );

  // Jobs not yet in tracker
  const jobsNotTracked = jobs.filter(j => !apps.some(a => a.jobId === j.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 28px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '2px' }}>
              PHASE 4 · APPLICATION TRACKER
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Job Pipeline
            </h1>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowAddModal(true)} style={primaryBtnStyle}>
              <Plus size={13} /> ADD JOB
            </button>
            <button onClick={handleExportCSV} disabled={apps.length === 0} style={secondaryBtnStyle(apps.length === 0)}>
              <Download size={13} /> CSV
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { label: 'TOTAL',      value: stats.total,          color: 'var(--text2)' },
            { label: 'APPLIED',    value: stats.applied,        color: '#60a5fa' },
            { label: 'INTERVIEW',  value: stats.interview,      color: '#fbbf24' },
            { label: 'OFFER',      value: stats.offer,          color: '#4ade80' },
            { label: 'REJECTED',   value: stats.rejected,       color: '#f87171' },
            { label: 'CONV.RATE',  value: `${stats.conversionRate}%`, color: stats.conversionRate >= 20 ? '#4ade80' : 'var(--amber)' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '4px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: s.color }}>{s.value}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.08em' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Kanban board ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '0',
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '0',
      }}>
        {APP_STATUSES.map(status => {
          const meta   = STATUS_META[status];
          const colApps = appsByStatus(status);
          const isOver  = dragOverCol === status;

          return (
            <div
              key={status}
              onDragOver={e => handleDragOver(e, status)}
              onDrop={e => handleDrop(e, status)}
              onDragLeave={() => setDragOverCol(null)}
              style={{
                flex: '0 0 220px',
                minWidth: '220px',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--border)',
                background: isOver ? `${meta.color}08` : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              {/* Column header */}
              <div style={{
                padding: '14px 16px 10px',
                borderBottom: `2px solid ${meta.color}44`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '10px', color: meta.accent }}>{meta.emoji}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.06em' }}>
                  {meta.label.toUpperCase()}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  color: colApps.length > 0 ? meta.accent : 'var(--text3)',
                  background: colApps.length > 0 ? `${meta.color}18` : 'var(--bg3)',
                  border: `1px solid ${colApps.length > 0 ? meta.color + '44' : 'var(--border)'}`,
                  padding: '1px 7px', borderRadius: '10px',
                }}>{colApps.length}</span>
              </div>

              {/* Cards */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {colApps.map(app => (
                  <KanbanCard
                    key={app.id}
                    app={app}
                    versions={versions}
                    isDragging={dragId === app.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onClick={() => setDrawerApp(app)}
                    onDelete={handleDelete}
                    onQuickStatus={async (newStatus) => {
                      const updated = await updateApplicationStatus(app.id, newStatus);
                      setApps(prev => prev.map(a => a.id === app.id ? updated : a));
                    }}
                  />
                ))}

                {/* Empty drop zone hint */}
                {colApps.length === 0 && (
                  <div style={{
                    padding: '20px 10px',
                    textAlign: 'center',
                    border: `1px dashed ${isOver ? meta.color : 'var(--border)'}`,
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: isOver ? meta.accent : 'var(--text3)',
                    transition: 'all 0.15s',
                  }}>
                    {isOver ? `Drop here` : 'Empty'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      {drawerApp && (
        <DetailDrawer
          app={drawerApp}
          versions={versions.filter(v => v.jobId === drawerApp.jobId)}
          onClose={() => setDrawerApp(null)}
          onUpdateField={handleUpdateField}
          onDelete={handleDelete}
          onStatusChange={async (newStatus) => {
            const updated = await updateApplicationStatus(drawerApp.id, newStatus);
            setApps(prev => prev.map(a => a.id === drawerApp.id ? updated : a));
          }}
        />
      )}

      {/* ── Add Modal ────────────────────────────────────────────────────── */}
      {showAddModal && (
        <AddModal
          jobs={jobs}
          jobsNotTracked={jobsNotTracked}
          versions={versions}
          onAdd={handleCreateApp}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ app, versions, isDragging, onDragStart, onDragEnd, onClick, onDelete, onQuickStatus }) {
  const meta = STATUS_META[app.status];
  const resumeV = versions.find(v => v.id === app.resumeVersionId);
  const isOverdue = app.nextActionDate && app.nextActionDate < Date.now() && app.status !== 'rejected' && app.status !== 'offer';

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, app.id)}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
        borderRadius: '6px',
        padding: '11px 13px',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transition: 'box-shadow 0.15s, opacity 0.15s',
        userSelect: 'none',
        position: 'relative',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 2px 12px rgba(0,0,0,0.3)`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Delete btn (top right) */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(app.id); }}
        style={{
          position: 'absolute', top: '6px', right: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text3)', opacity: 0, transition: 'opacity 0.15s',
          display: 'flex', alignItems: 'center',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--red)'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
        className="card-delete-btn"
      >
        <Trash2 size={11} />
      </button>
      <style>{`.card-delete-btn { opacity: 0 !important; } div:hover > .card-delete-btn { opacity: 1 !important; }`}</style>

      {/* Company + role */}
      <div onClick={onClick} style={{ cursor: 'pointer' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px', paddingRight: '16px' }}>
          {app.snapshot?.company || '—'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', marginBottom: '7px' }}>
          {app.snapshot?.role || '—'}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '7px' }}>
          {app.snapshot?.seniority && app.snapshot.seniority !== 'unknown' && (
            <Tag text={app.snapshot.seniority} color="var(--text3)" />
          )}
          {app.snapshot?.domain && app.snapshot.domain !== 'unknown' && (
            <Tag text={app.snapshot.domain} color="var(--text3)" />
          )}
          {app.snapshot?.location && app.snapshot.location !== 'Unknown' && (
            <Tag text={app.snapshot.location} color="var(--text3)" />
          )}
        </div>

        {/* Resume scores if linked */}
        {resumeV && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '7px' }}>
            <ScoreChip label="ATS" score={resumeV.atsScore} threshold={90} />
            <ScoreChip label="H" score={resumeV.humanScore} threshold={85} />
            {resumeV.passed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--green)', alignSelf: 'center' }}>✓ PASS</span>}
          </div>
        )}

        {/* Next action overdue badge */}
        {isOverdue && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', marginBottom: '5px' }}>
            <Clock size={10} /> Overdue: {app.nextAction || 'Follow up'}
          </div>
        )}

        {/* Applied date */}
        {app.appliedDate && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>
            Applied {new Date(app.appliedDate).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Quick move arrows */}
      <div style={{ display: 'flex', gap: '3px', marginTop: '8px', paddingTop: '7px', borderTop: '1px solid var(--border)' }}>
        {APP_STATUSES.filter(s => s !== app.status).map(s => (
          <button
            key={s}
            onClick={e => { e.stopPropagation(); onQuickStatus(s); }}
            title={`Move to ${STATUS_META[s].label}`}
            style={{
              flex: 1, padding: '3px 0',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '3px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '9px',
              color: STATUS_META[s].color,
              letterSpacing: '0.04em',
            }}
          >
            {STATUS_META[s].label.slice(0, 3).toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({ app, versions, onClose, onUpdateField, onDelete, onStatusChange }) {
  const [tab, setTab] = useState('details');
  const [editField, setEditField] = useState(null);
  const meta = STATUS_META[app.status];

  const Field = ({ label, field, value, type = 'text', placeholder = '' }) => {
    const [local, setLocal] = useState(value || '');
    const isEditing = editField === field;
    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', letterSpacing: '0.08em' }}>{label}</div>
        {isEditing ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type={type}
              value={local}
              autoFocus
              onChange={e => setLocal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onUpdateField(app.id, field, type === 'date' ? new Date(local).getTime() : local); setEditField(null); }
                if (e.key === 'Escape') setEditField(null);
              }}
              style={inputStyle}
            />
            <button onClick={() => { onUpdateField(app.id, field, type === 'date' ? (local ? new Date(local).getTime() : null) : local); setEditField(null); }}
              style={{ ...primaryBtnStyle, padding: '4px 10px', fontSize: '10px' }}>✓</button>
            <button onClick={() => setEditField(null)} style={{ ...ghostBtn, padding: '4px 8px' }}>✗</button>
          </div>
        ) : (
          <div
            onClick={() => { setLocal(type === 'date' && value ? new Date(value).toISOString().split('T')[0] : value || ''); setEditField(field); }}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: value ? 'var(--text)' : 'var(--text3)', cursor: 'text', padding: '5px 0', borderBottom: '1px dashed var(--border)', minHeight: '24px' }}
          >
            {type === 'date' && value ? new Date(value).toLocaleDateString() : (value || placeholder || <span style={{ color: 'var(--text3)' }}>Click to edit…</span>)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: '380px', zIndex: 500,
      background: 'var(--bg2)',
      borderLeft: '1px solid var(--border2)',
      display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
      animation: 'slideInRight 0.2s ease',
    }}>
      <style>{`@keyframes slideInRight { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

      {/* Drawer header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '11px', color: meta.accent }}>{meta.emoji}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                color: meta.accent, letterSpacing: '0.08em',
                background: `${meta.color}18`, padding: '1px 8px', borderRadius: '3px',
                border: `1px solid ${meta.color}33`,
              }}>{meta.label.toUpperCase()}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
              {app.snapshot?.company}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
              {app.snapshot?.role}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {app.snapshot?.url && (
              <a href={app.snapshot.url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, padding: '5px' }}>
                <ExternalLink size={13} />
              </a>
            )}
            <button onClick={() => onDelete(app.id)} style={{ ...ghostBtn, padding: '5px', color: 'var(--red)' }}>
              <Trash2 size={13} />
            </button>
            <button onClick={onClose} style={{ ...ghostBtn, padding: '5px' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Status quick-change */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
          {APP_STATUSES.map(s => (
            <button key={s} onClick={() => onStatusChange(s)} style={{
              padding: '4px 10px',
              background: app.status === s ? `${STATUS_META[s].color}22` : 'var(--bg3)',
              border: `1px solid ${app.status === s ? STATUS_META[s].color : 'var(--border)'}`,
              borderRadius: '3px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '10px',
              color: app.status === s ? STATUS_META[s].accent : 'var(--text3)',
              letterSpacing: '0.05em',
            }}>
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[
          { id: 'details',  label: 'DETAILS',  icon: <FileText size={11} /> },
          { id: 'resume',   label: 'RESUME',   icon: <BarChart2 size={11} /> },
          { id: 'activity', label: 'LOG',      icon: <Activity size={11} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '9px', background: 'none', border: 'none',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px',
            letterSpacing: '0.06em', color: tab === t.id ? 'var(--accent)' : 'var(--text3)',
            marginBottom: '-1px',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Drawer content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

        {tab === 'details' && (
          <div className="fade-in">
            <Field label="NOTES" field="notes" value={app.notes} placeholder="Add notes about this role..." />
            <Field label="APPLIED DATE" field="appliedDate" value={app.appliedDate} type="date" />
            <Field label="INTERVIEW DATE" field="interviewDate" value={app.interviewDate} type="date" />
            <Field label="NEXT ACTION" field="nextAction" value={app.nextAction} placeholder="e.g. Follow up email" />
            <Field label="NEXT ACTION DATE" field="nextActionDate" value={app.nextActionDate} type="date" />
            <Field label="CONTACT NAME" field="contactName" value={app.contactName} placeholder="Recruiter / hiring manager" />
            <Field label="CONTACT EMAIL" field="contactEmail" value={app.contactEmail} placeholder="recruiter@company.com" />
            <Field label="SALARY RANGE" field="salaryRange" value={app.salaryRange} placeholder="e.g. ₹8–12 LPA" />

            {/* Snapshot skills */}
            {app.snapshot?.mustHaveSkills?.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '6px', letterSpacing: '0.08em' }}>MUST-HAVE SKILLS</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {app.snapshot.mustHaveSkills.map(s => (
                    <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '2px 8px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '3px', color: 'var(--green)' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>
              Created {new Date(app.createdAt).toLocaleString()}
            </div>
          </div>
        )}

        {tab === 'resume' && (
          <div className="fade-in">
            {app.resumeSnapshot ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  <ScoreBlock label="ATS SCORE" score={app.resumeSnapshot.atsScore} threshold={90} />
                  <ScoreBlock label="HUMAN SCORE" score={app.resumeSnapshot.humanScore} threshold={85} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: app.resumeSnapshot.passed ? 'var(--green)' : 'var(--amber)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                  {app.resumeSnapshot.passed ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {app.resumeSnapshot.passed ? 'Passed both thresholds (ATS ≥90, Human ≥85)' : 'Did not pass score gate — review in Analyser'}
                </div>
                {versions.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '8px', letterSpacing: '0.08em' }}>TAILORED VERSIONS FOR THIS JOB</div>
                    {versions.map(v => (
                      <div key={v.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '5px', marginBottom: '6px', background: 'var(--bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>{new Date(v.createdAt).toLocaleDateString()}</span>
                          {v.passed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)' }}>✓ PASS</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <ScoreChip label="ATS" score={v.atsScore} threshold={90} />
                          <ScoreChip label="H" score={v.humanScore} threshold={85} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text3)' }}>
                No resume linked.<br />
                <span style={{ fontSize: '11px' }}>Tailor a resume for this job and re-add it.</span>
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div className="fade-in">
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '12px', letterSpacing: '0.08em' }}>ACTIVITY LOG</div>
            <div style={{ position: 'relative', paddingLeft: '16px', borderLeft: '1px solid var(--border)' }}>
              {[...(app.activityLog || [])].reverse().map((entry, i) => (
                <div key={i} style={{ marginBottom: '12px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-20px', top: '3px', width: '7px', height: '7px', borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--border2)', border: '1px solid var(--bg2)' }} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text)', marginBottom: '2px' }}>{entry.action}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>{new Date(entry.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function AddModal({ jobs, jobsNotTracked, versions, onAdd, onClose }) {
  const [selectedJob, setSelectedJob]     = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [showAll, setShowAll]             = useState(false);
  const [search, setSearch]               = useState('');

  const displayJobs = showAll ? jobs : jobsNotTracked;
  const filtered = displayJobs.filter(j =>
    `${j.company} ${j.role} ${j.domain}`.toLowerCase().includes(search.toLowerCase())
  );

  const jobVersions = versions.filter(v => v.jobId === selectedJob?.id);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '20px' }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: '560px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '10px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', marginBottom: '3px', letterSpacing: '0.08em' }}>ADD TO TRACKER</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>Select a Job</div>
          </div>
          <button onClick={onClose} style={{ ...ghostBtn, padding: '5px' }}><X size={14} /></button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company, role..."
            autoFocus
            style={{ ...inputStyle, width: '100%', marginBottom: '10px' }}
          />

          {/* Toggle all/not tracked */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>
            <button onClick={() => setShowAll(false)} style={{ ...ghostBtn, fontSize: '10px', padding: '3px 10px', borderColor: !showAll ? 'var(--accent)' : 'var(--border)', color: !showAll ? 'var(--accent)' : 'var(--text3)' }}>
              NEW ({jobsNotTracked.length})
            </button>
            <button onClick={() => setShowAll(true)} style={{ ...ghostBtn, fontSize: '10px', padding: '3px 10px', borderColor: showAll ? 'var(--accent)' : 'var(--border)', color: showAll ? 'var(--accent)' : 'var(--text3)' }}>
              ALL ({jobs.length})
            </button>
          </div>

          {/* Job list */}
          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '14px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text3)' }}>
                {jobs.length === 0 ? 'No jobs stored. Go to Collector first.' : 'No jobs match your search.'}
              </div>
            ) : filtered.map(job => (
              <button key={job.id} onClick={() => { setSelectedJob(job); setSelectedVersion(null); }} style={{
                padding: '10px 14px', textAlign: 'left',
                background: selectedJob?.id === job.id ? 'rgba(212,160,23,0.1)' : 'var(--bg3)',
                border: `1px solid ${selectedJob?.id === job.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '5px', cursor: 'pointer',
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {job.company} <span style={{ fontWeight: 400, color: 'var(--text2)' }}>— {job.role}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
                  {[job.seniority, job.domain, job.location].filter(v => v && v !== 'unknown' && v !== 'Unknown').join(' · ')}
                </div>
              </button>
            ))}
          </div>

          {/* Resume version picker */}
          {selectedJob && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '8px', letterSpacing: '0.08em' }}>
                LINK A TAILORED RESUME (OPTIONAL)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={() => setSelectedVersion(null)} style={{
                  padding: '8px 12px', textAlign: 'left', background: !selectedVersion ? 'rgba(212,160,23,0.08)' : 'var(--bg3)',
                  border: `1px solid ${!selectedVersion ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '4px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)',
                }}>
                  No resume linked
                </button>
                {jobVersions.map(v => (
                  <button key={v.id} onClick={() => setSelectedVersion(v)} style={{
                    padding: '8px 12px', textAlign: 'left',
                    background: selectedVersion?.id === v.id ? 'rgba(212,160,23,0.08)' : 'var(--bg3)',
                    border: `1px solid ${selectedVersion?.id === v.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '4px', cursor: 'pointer',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)' }}>{new Date(v.createdAt).toLocaleDateString()}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <ScoreChip label="ATS" score={v.atsScore} threshold={90} />
                        <ScoreChip label="H" score={v.humanScore} threshold={85} />
                        {v.passed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--green)' }}>✓</span>}
                      </div>
                    </div>
                  </button>
                ))}
                {jobVersions.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', padding: '6px 0' }}>
                    No tailored resumes for this job yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Add button */}
          <button
            onClick={() => selectedJob && onAdd(selectedJob, selectedVersion)}
            disabled={!selectedJob}
            style={{ ...primaryBtnStyle, width: '100%', justifyContent: 'center', opacity: selectedJob ? 1 : 0.4 }}
          >
            <Plus size={14} />
            ADD TO TRACKER
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small reusable components ─────────────────────────────────────────────────
function Tag({ text, color }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color, background: 'var(--bg3)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: '3px' }}>
      {text}
    </span>
  );
}

function ScoreChip({ label, score, threshold }) {
  const pass = score >= threshold;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '10px',
      color: pass ? 'var(--green)' : 'var(--amber)',
      background: pass ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
      border: `1px solid ${pass ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
      padding: '1px 6px', borderRadius: '3px',
    }}>
      {label} {score}
    </span>
  );
}

function ScoreBlock({ label, score, threshold }) {
  const pass = score >= threshold;
  return (
    <div style={{ padding: '12px', background: 'var(--bg)', border: `1px solid ${pass ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '6px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 600, color: pass ? 'var(--green)' : 'var(--amber)' }}>{score || '—'}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: pass ? 'var(--green)' : 'var(--amber)' }}>/{threshold}</div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />;
}

// ── Shared button / input styles ──────────────────────────────────────────────
const primaryBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '7px',
  background: 'var(--accent)', color: '#000',
  border: 'none', borderRadius: '4px',
  padding: '8px 16px', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500,
  letterSpacing: '0.06em',
};

const secondaryBtnStyle = (disabled) => ({
  display: 'flex', alignItems: 'center', gap: '7px',
  background: 'var(--bg3)', color: disabled ? 'var(--text3)' : 'var(--text2)',
  border: '1px solid var(--border2)', borderRadius: '4px',
  padding: '8px 14px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '12px',
  letterSpacing: '0.06em', opacity: disabled ? 0.5 : 1,
});

const ghostBtn = {
  display: 'flex', alignItems: 'center', gap: '5px',
  background: 'none', color: 'var(--text3)',
  border: '1px solid var(--border)', borderRadius: '4px',
  padding: '5px 10px', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '11px',
};

const inputStyle = {
  background: 'var(--bg)', border: '1px solid var(--border2)',
  borderRadius: '4px', padding: '7px 11px',
  color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px',
  outline: 'none',
};
