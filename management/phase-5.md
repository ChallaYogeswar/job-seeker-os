src/utils/llmProvider.js        ← Unified router: Groq, OpenRouter, Kimi, Nvidia NIM, Ollama
src/utils/pdfExport.js          ← ATS-safe PDF via html2pdf.js (CDN), markdown → clean HTML
src/pages/SettingsPage.jsx      ← Full rebuild: provider cards, per-key test, data tab
src/components/ErrorBoundary.jsx ← Per-page error recovery
src/components/Skeleton.jsx     ← Shimmer skeleton loaders
README.md                       ← Full project documentation
PDF Export — one-click from TailorPage Review step. Renders your markdown resume into a single-column, ATS-safe HTML template (Arial font, 0.7" margins, no tables/icons/multi-column), then generates a properly named PDF via html2pdf.js loaded from CDN. File named Company_Role_Resume.pdf.
LLM Provider Router — llmProvider.js is a unified interface. Every call goes through it. It builds a fallback chain (primary → any other provider with a key configured), handles streaming for Groq/OpenRouter, handles Ollama's different response format, and throws clean errors with provider context. Auto-fallback on 429 rate limits.
Settings overhaul — 3 tabs: Providers (visual cards to pick active provider, per-provider key input + TEST button with live connection check, Ollama shows local server check), Behavior (auto-fallback toggle, request delay slider, session limit slider), Data (storage stats for jobs/resumes/applications, clear buttons, privacy note).

Run it:
bashunzip job-seeker-os-v1.0-FINAL.zip
cd job-seeker-os
npm install
npm run dev
Deploy free to Vercel:
bashnpm run build
# Push to GitHub → connect repo to vercel.com → auto-deploys on every push
The full pipeline end-to-end:
Settings (add Groq key) → Collector (paste URLs → extract jobs) → Tailor (upload resume → generate → score → PDF) → Analyser (radar → section drill-down → bullet annotator) → Tracker (kanban → track status → CSV export)