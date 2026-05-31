# Job Seeker OS

A browser-based, zero-cost, offline-capable job application management system.
Collect job links → extract descriptions → tailor resumes → score against ATS & recruiter rubrics → track applications.

**100% free. No backend. No account. All data stays in your browser.**

---

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

Go to **Settings → LLM Providers**, add your free Groq API key from [console.groq.com](https://console.groq.com).

---

## What's Built (5 Phases)

| Phase | Feature |
|-------|---------|
| 1 — Collector | Paste job URLs → deduplicate → scrape via Jina Reader → extract structured JD → export .md |
| 2 — Tailor    | Upload resume → select job → generate tailored version → ATS + Human scoring → retry loop |
| 3 — Analyser  | Radar chart · per-section deep dive · bullet-by-bullet annotator · version comparison |
| 4 — Tracker   | Kanban board · drag-and-drop · detail drawer · activity log · CSV export |
| 5 — Polish    | Multi-provider LLM router · PDF export · error boundary · settings overhaul |

---

## Free LLM Providers

| Provider | Free Tier | Get Key |
|----------|-----------|---------|
| **Groq** ← recommended | 14,400 req/day, very fast | [console.groq.com](https://console.groq.com) |
| OpenRouter | Free model tier | [openrouter.ai](https://openrouter.ai) |
| Kimi (Moonshot) | Free credits | [platform.moonshot.cn](https://platform.moonshot.cn) |
| Nvidia NIM | $0.35 free credit | [build.nvidia.com](https://build.nvidia.com) |
| Ollama | Unlimited local | [ollama.com](https://ollama.com) |

Auto-fallback switches providers automatically on rate limits.

---

## Scoring

- **ATS Score** (90+ to pass) — deterministic rule engine, no API needed
- **Human Score** (85+ to pass) — LLM recruiter rubric, 6-second scan test
- Auto-retries up to 3× with targeted feedback if thresholds not met

---

## Stack

React + Vite · IndexedDB · Jina Reader · Groq/OpenRouter/Kimi/Nvidia/Ollama · html2pdf.js

All free. No backend. Deploy to GitHub Pages / Vercel / Netlify from `dist/`.

---

MIT License
