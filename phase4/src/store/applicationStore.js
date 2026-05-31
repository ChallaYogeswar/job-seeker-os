import { getDB } from './db.js';

export const APP_STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'];

export const STATUS_META = {
  saved:     { label: 'Saved',     color: '#6b7280', accent: '#9ca3af', emoji: '◇' },
  applied:   { label: 'Applied',   color: '#3b82f6', accent: '#60a5fa', emoji: '◈' },
  interview: { label: 'Interview', color: '#f59e0b', accent: '#fbbf24', emoji: '◉' },
  offer:     { label: 'Offer',     color: '#22c55e', accent: '#4ade80', emoji: '●' },
  rejected:  { label: 'Rejected',  color: '#ef4444', accent: '#f87171', emoji: '✗' },
};

export async function saveApplication(app) {
  const db = await getDB();
  await db.put('applications', app);
}

export async function getAllApplications() {
  const db = await getDB();
  return db.getAll('applications');
}

export async function getApplication(id) {
  const db = await getDB();
  return db.get('applications', id);
}

export async function updateApplicationStatus(id, status) {
  const db = await getDB();
  const app = await db.get('applications', id);
  if (!app) return;
  const updated = {
    ...app,
    status,
    updatedAt: Date.now(),
    activityLog: [
      ...(app.activityLog || []),
      { action: `Moved to ${STATUS_META[status]?.label || status}`, ts: Date.now() },
    ],
  };
  await db.put('applications', updated);
  return updated;
}

export async function updateApplication(id, updates) {
  const db = await getDB();
  const app = await db.get('applications', id);
  if (!app) return;
  const updated = { ...app, ...updates, updatedAt: Date.now() };
  await db.put('applications', updated);
  return updated;
}

export async function deleteApplication(id) {
  const db = await getDB();
  await db.delete('applications', id);
}

export function createApplication({ job, resumeVersion }) {
  return {
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    jobId: job.id,
    resumeVersionId: resumeVersion?.id || null,
    // Snapshot job data so it stays accurate even if job is deleted
    snapshot: {
      company: job.company,
      role: job.role,
      seniority: job.seniority,
      location: job.location,
      domain: job.domain,
      url: job.url,
      mustHaveSkills: job.mustHaveSkills || [],
    },
    resumeSnapshot: resumeVersion
      ? { atsScore: resumeVersion.atsScore, humanScore: resumeVersion.humanScore, passed: resumeVersion.passed }
      : null,
    status: 'saved',
    appliedDate: null,
    interviewDate: null,
    nextAction: '',
    nextActionDate: null,
    notes: '',
    contactName: '',
    contactEmail: '',
    salaryRange: '',
    activityLog: [{ action: 'Application created', ts: Date.now() }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Export applications to CSV string */
export function exportApplicationsCSV(apps) {
  const headers = ['Company', 'Role', 'Status', 'Applied Date', 'ATS Score', 'Human Score', 'Notes', 'URL'];
  const rows = apps.map(app => [
    app.snapshot?.company || '',
    app.snapshot?.role || '',
    app.status,
    app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : '',
    app.resumeSnapshot?.atsScore || '',
    app.resumeSnapshot?.humanScore || '',
    (app.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
    app.snapshot?.url || '',
  ]);
  return [headers, ...rows].map(r => r.join(',')).join('\n');
}
