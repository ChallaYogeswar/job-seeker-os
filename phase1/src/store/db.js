import { openDB } from 'idb';

const DB_NAME = 'JobSeekerOS';
const DB_VERSION = 1;

let dbInstance = null;

export async function getDB() {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Jobs store
      if (!db.objectStoreNames.contains('jobs')) {
        const jobStore = db.createObjectStore('jobs', { keyPath: 'id' });
        jobStore.createIndex('status', 'status');
        jobStore.createIndex('createdAt', 'createdAt');
      }
      // Base resume store
      if (!db.objectStoreNames.contains('baseResume')) {
        db.createObjectStore('baseResume', { keyPath: 'id' });
      }
      // Tailored resumes store
      if (!db.objectStoreNames.contains('tailoredResumes')) {
        const trStore = db.createObjectStore('tailoredResumes', { keyPath: 'id' });
        trStore.createIndex('jobId', 'jobId');
      }
      // Applications store
      if (!db.objectStoreNames.contains('applications')) {
        const appStore = db.createObjectStore('applications', { keyPath: 'id' });
        appStore.createIndex('jobId', 'jobId');
        appStore.createIndex('status', 'status');
      }
    },
  });
  return dbInstance;
}

// ─── Jobs ───────────────────────────────────────────────────────────────────
export async function saveJob(job) {
  const db = await getDB();
  await db.put('jobs', job);
}

export async function getAllJobs() {
  const db = await getDB();
  return db.getAll('jobs');
}

export async function getJob(id) {
  const db = await getDB();
  return db.get('jobs', id);
}

export async function deleteJob(id) {
  const db = await getDB();
  await db.delete('jobs', id);
}

export async function clearAllJobs() {
  const db = await getDB();
  await db.clear('jobs');
}
