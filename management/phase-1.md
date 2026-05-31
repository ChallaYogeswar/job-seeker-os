src/
├── App.jsx                     ← Main router + layout
├── index.css                   ← Global styles (IBM Plex Mono + Syne font)
├── components/
│   ├── Sidebar.jsx             ← Navigation with job counter
│   └── Toast.jsx               ← Notification system
├── pages/
│   ├── CollectorPage.jsx       ← The main Phase 1 UI (3 views)
│   └── SettingsPage.jsx        ← API key manager
├── store/
│   ├── db.js                   ← IndexedDB wrapper (idb)
│   └── settings.js             ← localStorage for API keys
└── utils/
    ├── dedup.js                ← URL normalize + deduplicate
    ├── jinaFetch.js            ← Jina Reader scraper + fallback
    ├── jdParser.js             ← Groq LLM JD extractor
    └── mdExport.js             ← .md file generator + download


How to run it:
cd job-seeker-os
npm install
npm run dev
Then open http://localhost:5173 — go to Settings first, paste your free Groq API key (get it at console.groq.com), hit Test, then Save.
What Phase 1 does end-to-end:

Paste any number of job URLs (or upload a .txt file) → deduplicates instantly, strips tracking params
Process All → each URL hits Jina Reader → raw text extracted
If Jina gets blocked → amber "PASTE JD" button appears inline → modal lets you paste the JD manually
LLM (Groq Llama 3.3 70B) extracts: company, role, seniority, location, must-have skills, nice-to-have, requirements, domain
All stored in IndexedDB — survives browser refresh, no backend
Export all jobs as a structured .md file → one click