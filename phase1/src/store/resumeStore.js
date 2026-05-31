import { getDB } from './db.js';

// ─── Base Resume ─────────────────────────────────────────────────────────────

export async function saveBaseResume(resumeData) {
  const db = await getDB();
  await db.put('baseResume', { id: 'base', ...resumeData, updatedAt: Date.now() });
}

export async function getBaseResume() {
  const db = await getDB();
  return db.get('baseResume', 'base');
}

// ─── Tailored Resumes ─────────────────────────────────────────────────────────

export async function saveTailoredResume(tailored) {
  const db = await getDB();
  await db.put('tailoredResumes', tailored);
}

export async function getTailoredResumesForJob(jobId) {
  const db = await getDB();
  return db.getAllFromIndex('tailoredResumes', 'jobId', jobId);
}

export async function getAllTailoredResumes() {
  const db = await getDB();
  return db.getAll('tailoredResumes');
}

export async function deleteTailoredResume(id) {
  const db = await getDB();
  await db.delete('tailoredResumes', id);
}

export function generateVersionId(jobId) {
  return `${jobId}_v${Date.now()}`;
}
