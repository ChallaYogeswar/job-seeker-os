src/pages/TailorPage.jsx       ← Full 4-step UI (560+ lines)
src/utils/resumeParser.js      ← Parses .txt / .md / .pdf into sections
src/utils/tailorPrompt.js      ← Protocol constitution + Groq streaming
src/utils/atsScorer.js         ← Deterministic rule engine, no API needed
src/utils/humanScorer.js       ← LLM rubric scorer, returns structured JSON
src/utils/scoreGate.js         ← Retry orchestrator (max 3 attempts)
src/store/resumeStore.js       ← Base resume + version CRUD on IndexedDB

The 4-step Tailor flow:
Step 1 — Resume Upload: Drag-drop or click to upload .txt, .md, or .pdf. PDF text extraction via PDF.js loaded from CDN. Paste-mode fallback. Detects and shows parsed sections, word count, estimated page count. Warns if fewer than 4 sections detected. Experience level selector (Fresher = strict 1 page).
Step 2 — Job Select: Searchable list of all jobs from your Collector. Shows company, role, seniority, domain, and must-have skills. One click to select.
Step 3 — Generate: Live log feed shows every step in real time (timestamps). First attempt streams the resume character-by-character into a preview pane. If ATS < 90 or Human < 85, auto-builds a targeted feedback prompt and regenerates — up to 3 attempts.
Step 4 — Review: Three tabs — Resume Preview (formatted markdown), ATS Breakdown (per-section table with scores, status dots, and exact fix suggestions), Human Scorer (collapsible section groups with per-check scores and one-line reasons). Save versions, download as .md, see Top Strength and Top Fix Needed cards from the recruiter scorer. All versions stored in IndexedDB, linked to the job.

How to run:

cd job-seeker-os
npm install
npm run dev
Go to Settings first → add Groq API key → Test → Save. Then Collector (add jobs) → Tailor.