src/utils/sectionAnalyser.js   ← Deep per-section content engine (400+ lines)
src/pages/AnalyserPage.jsx     ← Full dashboard UI (550+ lines)

What sectionAnalyser.js does:
Each section gets its own analyser function with different logic — not just regex counting:

Header — checks name, email, phone, LinkedIn, GitHub, no icons, no banned personal info
Summary — checks role title present, specialization clarity, word count 15–60, no first-person, no filler, mentions experience years
Skills — checks all 4 groups present (Languages, CS Fundamentals, Tools, Platforms), no soft skills, JD keyword match rate
Projects — checks 2–3 projects, tech stack shown, year present, runs full bullet annotation on every bullet
Experience — checks job title, company, dates, runs bullet annotation, flags banned verbs
Education — checks degree name, institution, year, CGPA/GPA, no personal info mixed in
annotateBullets() — per-bullet scoring: strong verb detection, metric detection, word count check (8–25 words), filler phrase scan, first-person detection. Each bullet gets a score 0–100 and grade: strong / ok / weak


What AnalyserPage.jsx delivers — 4 tabs:
Overview — Radar chart (pure SVG, no library), 6 section scores plotted. Key metrics grid: overall score, bullet count, metric rate, strong verb rate, weak bullet count, word count. Priority Fixes panel shows your 2 weakest sections with inline fix. ATS Rule Engine quick-view bar.
Sections — Click any section from the left list to see: full checklist with pass/fail per rule, action items highlighted in amber, bullet-level breakdown if the section has bullets, missing JD keyword tags in red for the Skills section.
Bullets — All bullets across the full resume shown in one list. Filter by STRONG / OK / WEAK. Each bullet shows inline M (metric), V (strong verb), ! (banned verb), M? (no metric) tags. Click to expand the specific issues for that bullet with exact fix instructions.
Compare — Side-by-side grid against any other saved version. Every metric compared: overall score, metric rate, strong verb rate, weak bullet count, and all 6 section scores. Green highlight + ▲ arrow on whichever version wins each row.

Run it:
cd job-seeker-os
npm install
npm run dev
