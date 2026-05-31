# Job Seeker OS — Master Build Plan
### Full-Stack Product Blueprint · Phase-by-Phase · 100% Free Stack

---

## Project Vision

A browser-based, zero-cost, offline-capable Job Seeker Operating System that collects job links from daily email alerts, extracts job descriptions, tailors resumes using strict formatting rules, scores every output against ATS and human-recruiter rubrics, and tracks applications — all without any paid API or backend server.

---

## Architecture Overview

```
[Job Links Input]
       ↓
[Dedup Engine]
       ↓
[JD Extractor — Jina Reader + Manual Fallback]
       ↓
[Structured Job Store — IndexedDB]
       ↓
[Resume Tailor — Groq LLM / Ollama]
       ↓
[ATS Scorer — Rule Engine] + [Human Scorer — LLM Rubric]
       ↓
[Score Gate: ATS ≥ 90, Human ≥ 85]
       ↓
[Section Analyser Dashboard]
       ↓
[PDF Export — ATS-Safe Format]
       ↓
[Application Tracker Kanban]
```

---

## Tech Stack (All Free)

| Layer | Tool | Cost | Notes |
|---|---|---|---|
| Frontend | React + Tailwind CSS | Free | Static, no server needed |
| Hosting | GitHub Pages / Vercel free | Free | Auto-deploy from repo |
| Storage | IndexedDB (browser-native) | Free | Zero backend, offline works |
| Scraping | Jina Reader API | Free | `https://r.jina.ai/{url}` — no key |
| LLM Primary | Groq API (Llama 3) | Free tier | Very fast, generous limits |
| LLM Secondary | Kimi / Nvidia NIM | Free tier | Fallback when Groq hits limit |
| LLM Offline | Ollama (local) | Free | User runs locally, no API calls |
| PDF Export | html2pdf.js / jsPDF | Free | Browser-side PDF generation |
| ATS Scoring | Custom rule engine (JS) | Free | Deterministic, no API needed |
| Human Scoring | Groq LLM + rubric prompt | Free | Structured LLM evaluation |

---

## Phase Breakdown

---

## Phase 1 — Job Link Collector & JD Extractor
**Goal:** Paste or upload job URLs → deduplicate → extract structured JD → export as .md

### What to Build
- URL input: paste multi-line or upload .txt/.csv
- Deduplication engine: normalize URLs, hash-compare, remove duplicates
- Jina Reader integration: `fetch('https://r.jina.ai/' + url)`
- Manual fallback: if Jina fails, show "Paste JD here" text box
- LLM parsing call: extract company, role, requirements, skills, seniority from raw text
- Job card UI: shows extracted data per job with status badge
- Markdown export: download all jobs as structured .md file

### Deliverables
- `/src/pages/CollectorPage.jsx`
- `/src/utils/dedup.js`
- `/src/utils/jinaFetch.js`
- `/src/utils/jdParser.js` (LLM call)
- `/src/store/jobStore.js` (IndexedDB wrapper)

### Rate Limit Strategy
- Jina: no key required, but add 1.5s delay between requests to avoid blocks
- Groq: batch parse up to 5 JDs per API call using a structured list prompt
- Session limit: process max 20 jobs per session, save state to IndexedDB

### Output Format (per job in .md)
```markdown
## [Company Name] — [Job Role]
**Seniority:** Mid / Senior / Lead
**Location:** Remote / On-site / Hybrid
**Key Requirements:**
- Requirement 1
- Requirement 2
**Must-Have Skills:** Python, React, AWS
**Nice-to-Have:** Docker, Kubernetes
**JD Summary:** 2–3 sentence summary
**Source URL:** https://...
```

---

## Phase 2 — Resume Tailor Engine
**Goal:** Upload base resume → select job → generate tailored resume using protocol rules

### What to Build
- Resume upload: accept .txt, .md, or .pdf (text extraction)
- Resume parser: extract sections (Summary, Skills, Projects, Experience, Education)
- Job selector: pick from stored jobs (from Phase 1)
- Tailoring prompt engine: structured system prompt based on resume protocol
- Output renderer: show tailored resume in preview pane
- Version storage: save each tailored version linked to job ID in IndexedDB

### Tailoring System Prompt (embedded in code)
```
You are a professional resume tailoring engine.
RULES — NEVER BREAK THESE:

STRUCTURE (in this exact order):
1. Header: Name + Contact (email, phone, LinkedIn, GitHub — NO icons)
2. Summary (3 lines max, role-specific)
3. Skills (grouped: Languages | CS Fundamentals | Tools | Platforms)
4. Projects (2–3, most relevant to this job)
5. Experience (reverse chronological)
6. Education
7. Certifications (only if directly relevant)

CONTENT RULES:
- Every bullet: [Strong Verb] + [What] + [Result with metric]
- Strong verbs: Built, Developed, Designed, Implemented, Optimized, Architected, Automated
- BANNED verbs: Worked, Learned, Gained, Helped, Assisted
- Every project/experience bullet must include a metric (%, time, scale, accuracy)
- Role clarity: ONE target role only — no mixed positioning
- Keyword injection: match 5–8 keywords from the JD naturally in bullets
- First-person writing BANNED ("I built..." → "Built...")

DESIGN RULES (ATS-critical):
- Single column ONLY
- No icons, no symbols, no tables, no graphics
- No Declaration, DOB, Father's Name, Photo, Hobbies
- Font: Times New Roman / Arial / Calibri, 10–11pt
- Margins: 0.6–0.8 inch
- Compact bullets, no extra blank lines

LENGTH:
- Fresher (0–2 years): STRICTLY 1 page
- Experienced (3+ years): max 2 pages

CUSTOMIZATION:
- Modify only 5–10% keywords per job from base resume
- Do not rewrite everything — adapt strategically

OUTPUT FORMAT:
Return ONLY the resume in clean markdown. No preamble. No explanation.
Use ## for section headings, **bold** for company/project names.
```

### Deliverables
- `/src/pages/TailorPage.jsx`
- `/src/utils/resumeParser.js`
- `/src/utils/tailorPrompt.js`
- `/src/utils/versionStore.js`

---

## Phase 3 — ATS Scorer (Rule Engine)
**Goal:** Score every tailored resume 0–100 using deterministic rules, no API needed

### Scoring Rubric — ATS Score (Total: 100 points)

#### Section A: Structure Compliance (20 pts)
| Check | Points | Logic |
|---|---|---|
| Required sections present (Header, Summary, Skills, Projects, Experience, Education) | 10 | 2 pts per section, max 10 |
| Correct section order | 4 | All 6 sections in protocol order = 4, any out of order = 0 |
| No banned sections (DOB, Photo, Hobbies, Declaration) | 6 | -2 per banned section found |

#### Section B: Keyword Match (25 pts)
| Check | Points | Logic |
|---|---|---|
| JD keyword match rate (must-have skills) | 15 | (matched / total must-have) × 15 |
| Role title match in Summary | 5 | Target role appears in Summary = 5, else 0 |
| Job-specific terminology density | 5 | ≥ 5 unique JD terms in resume = 5, scaled below |

#### Section C: Content Quality (25 pts)
| Check | Points | Logic |
|---|---|---|
| Bullet formula compliance: Verb + What + Result | 10 | (compliant bullets / total bullets) × 10 |
| Metrics presence | 10 | (bullets with metric / total bullets) × 10 |
| Strong verb usage | 5 | (strong verb bullets / total bullets) × 5 |

#### Section D: ATS Formatting (20 pts)
| Check | Points | Logic |
|---|---|---|
| No icons or special symbols detected | 5 | Regex scan for ☎✉📍 and Unicode > 0x00FF |
| No tables or multi-column markers detected | 5 | Scan for markdown table syntax and column patterns |
| Text is clean (no encoding artifacts) | 5 | Scan for ¡ Ó ƍ ¯ patterns |
| No first-person pronouns | 5 | Scan for "I built", "I designed", "my project" etc. |

#### Section E: Length Compliance (10 pts)
| Check | Points | Logic |
|---|---|---|
| Page length appropriate | 10 | Fresher 1 page = 10, Experienced ≤ 2 pages = 10, else scaled |

### Scoring Implementation (JavaScript)
```javascript
function scoreATS(resumeText, jobData, experienceLevel) {
  let score = 0;
  const details = {};

  // A: Structure
  const requiredSections = ['summary', 'skills', 'projects', 'experience', 'education'];
  const foundSections = requiredSections.filter(s =>
    resumeText.toLowerCase().includes(s)
  );
  details.structureScore = (foundSections.length / requiredSections.length) * 10;

  const bannedSections = ['declaration', 'date of birth', 'father', 'hobbies', 'photo'];
  const bannedFound = bannedSections.filter(s => resumeText.toLowerCase().includes(s));
  details.bannedPenalty = bannedFound.length * 2;

  // B: Keywords
  const mustHaveSkills = jobData.mustHaveSkills || [];
  const matched = mustHaveSkills.filter(skill =>
    resumeText.toLowerCase().includes(skill.toLowerCase())
  );
  details.keywordScore = mustHaveSkills.length > 0
    ? (matched.length / mustHaveSkills.length) * 25
    : 12.5;

  // C: Bullet quality
  const bullets = resumeText.match(/^[-•*]\s.+/gm) || [];
  const strongVerbs = ['built','developed','designed','implemented','optimized',
    'architected','automated','engineered','created','launched','led','reduced',
    'increased','improved','delivered','deployed'];
  const metricPattern = /\d+%|\d+x|\d+\s*(ms|sec|hrs?|days?|weeks?|months?|records?|users?|requests?)/i;

  const verbCompliant = bullets.filter(b =>
    strongVerbs.some(v => b.toLowerCase().includes(v))
  ).length;
  const metricCompliant = bullets.filter(b => metricPattern.test(b)).length;

  details.bulletScore = bullets.length > 0
    ? ((verbCompliant / bullets.length) * 10) + ((metricCompliant / bullets.length) * 15)
    : 0;

  // D: ATS formatting
  const iconPattern = /[\u2600-\u27BF\u2B50-\u2B55\u{1F000}-\u{1FFFF}]/u;
  const encodingPattern = /¡|Ó|ƍ|¯|â€|Ã/;
  const firstPersonPattern = /\bI (built|designed|developed|created|worked|led|managed)\b/i;
  const tablePattern = /\|.+\|.+\|/;

  details.formattingScore =
    (!iconPattern.test(resumeText) ? 5 : 0) +
    (!tablePattern.test(resumeText) ? 5 : 0) +
    (!encodingPattern.test(resumeText) ? 5 : 0) +
    (!firstPersonPattern.test(resumeText) ? 5 : 0);

  // E: Length
  const wordCount = resumeText.split(/\s+/).length;
  const maxWords = experienceLevel === 'fresher' ? 450 : 900;
  details.lengthScore = wordCount <= maxWords ? 10 : Math.max(0, 10 - Math.floor((wordCount - maxWords) / 50));

  score = details.structureScore + details.keywordScore +
          details.bulletScore + details.formattingScore +
          details.lengthScore - details.bannedPenalty;

  return { score: Math.round(Math.min(100, Math.max(0, score))), details };
}
```

---

## Phase 4 — Human Recruiter Scorer (LLM Rubric)
**Goal:** Score resume from a recruiter's 6-second scan perspective using LLM + strict rubric

### Scoring Rubric — Human Score (Total: 100 points)

The "6-second rule": a recruiter decides in 6 seconds if they want to read further. The resume must pass a visual and cognitive scan of the top third of page one before anything else is evaluated.

#### Section A: Above-the-Fold Impact (30 pts)
| Check | Points | What to evaluate |
|---|---|---|
| Name and contact clearly visible at top | 5 | No hunting, no confusion |
| Summary opens with the target role by name | 5 | "Software Engineer with 2 years..." not "Passionate professional..." |
| Summary shows ONE clear specialization | 10 | Is it immediately clear what this person does? |
| First bullet of first job/project has a strong metric | 10 | The highest-impact achievement must be visible in first scan |

#### Section B: Clarity and Readability (25 pts)
| Check | Points | What to evaluate |
|---|---|---|
| Every bullet is under 2 lines | 5 | No run-on bullets |
| Language is direct and concrete | 10 | No jargon soup, no passive voice, no overcomplex words |
| Section labels are instantly recognizable | 5 | "Experience" not "Professional Journey" |
| No template artifacts or generic filler | 5 | No "Results-oriented professional", no "passionate about..." |

#### Section C: Relevance Signal (25 pts)
| Check | Points | What to evaluate |
|---|---|---|
| Top 3 JD skills appear in Skills section | 10 | Exact match or close synonym |
| Projects/experience are relevant to this job's domain | 10 | Domain match, not random portfolio |
| Seniority level matches the job requirement | 5 | Don't apply junior resume to senior role |

#### Section D: Professional Polish (20 pts)
| Check | Points | What to evaluate |
|---|---|---|
| No typos or grammatical errors | 10 | Professionalism baseline |
| Consistent tense usage (past tense for past roles) | 5 | Inconsistent tense = careless |
| Visual cleanliness (no clutter, no excessive bold) | 5 | Does it look clean? |

### Human Score Prompt (sent to LLM)
```
You are an experienced technical recruiter. You have exactly 6 seconds to scan this resume.
Evaluate it using the rubric below. Return ONLY a JSON object — no other text.

RUBRIC:
A. Above-the-fold impact (30 pts):
   - Clear name + contact visible: 0-5
   - Summary opens with role title: 0-5
   - Summary shows one clear specialization: 0-10
   - First achievement bullet has strong metric: 0-10

B. Clarity and readability (25 pts):
   - All bullets under 2 lines: 0-5
   - Direct and concrete language: 0-10
   - Section labels instantly clear: 0-5
   - No template filler text: 0-5

C. Relevance signal (25 pts):
   - Top 3 JD skills present in Skills section: 0-10
   - Projects/experience match job domain: 0-10
   - Seniority level matches job: 0-5

D. Professional polish (20 pts):
   - No typos or grammar errors: 0-10
   - Consistent tense usage: 0-5
   - Visual cleanliness: 0-5

For each check, provide: score (number) and reason (one sentence, max 12 words).

JOB DESCRIPTION:
{JD_TEXT}

RESUME:
{RESUME_TEXT}

Return JSON:
{
  "totalScore": number,
  "sectionScores": {
    "aboveTheFold": { "total": number, "checks": { "nameContact": {"score":n,"reason":"..."}, ... } },
    "clarity": { "total": number, "checks": { ... } },
    "relevance": { "total": number, "checks": { ... } },
    "polish": { "total": number, "checks": { ... } }
  },
  "topWeakness": "One-sentence actionable fix",
  "topStrength": "One-sentence strongest element",
  "verdict": "PASS" | "FAIL"
}
```

### Score Gate Logic
```javascript
async function scoreAndGate(resumeText, jobData, experienceLevel, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const atsResult = scoreATS(resumeText, jobData, experienceLevel);
    const humanResult = await scoreHuman(resumeText, jobData); // LLM call

    if (atsResult.score >= 90 && humanResult.totalScore >= 85) {
      return { passed: true, ats: atsResult, human: humanResult, attempt };
    }

    if (attempt < maxRetries) {
      // Inject failure feedback into next tailoring attempt
      const feedback = buildFeedbackPrompt(atsResult, humanResult);
      resumeText = await retailorWithFeedback(resumeText, jobData, feedback);
    }
  }
  // After 3 failed attempts, return best result + show breakdown for manual fix
  return { passed: false, ats: atsResult, human: humanResult, needsManualReview: true };
}
```

---

## Phase 5 — Section Analyser Dashboard
**Goal:** Visual breakdown of every resume section with scores, flags, and fix suggestions

### Dashboard Layout
```
┌─────────────────────────────────────────────────┐
│  RESUME ANALYSER                                 │
│  ATS: 87/100  Human: 82/100  Status: NEEDS WORK  │
├──────────────┬──────────────────────────────────┤
│ Section      │ Score │ Flag     │ Fix             │
├──────────────┼───────┼──────────┼─────────────────┤
│ Header       │  95   │ ✅ Pass  │ —               │
│ Summary      │  72   │ ⚠ Weak  │ Add role title  │
│ Skills       │  88   │ ✅ Pass  │ —               │
│ Projects     │  65   │ ❌ Low   │ Add metrics     │
│ Experience   │  91   │ ✅ Pass  │ —               │
│ Education    │  98   │ ✅ Pass  │ —               │
├──────────────┼───────┼──────────┼─────────────────┤
│ Formatting   │  90   │ ✅ Pass  │ —               │
│ Keywords     │  78   │ ⚠ Weak  │ Add 3 JD terms  │
│ Metrics      │  60   │ ❌ Low   │ 4 bullets weak  │
└──────────────┴───────┴──────────┴─────────────────┘
```

### Per-Section Scoring Logic

| Section | Key Signals | Max Score |
|---|---|---|
| Header | Name present, email valid, LinkedIn/GitHub present, no icons, no DOB/photo | 100 |
| Summary | Opens with role title, ≤3 lines, no first-person, no generic filler, role-specific | 100 |
| Skills | Grouped correctly (Languages/Tools/Platforms), JD keyword overlap ≥ 60%, no soft skills | 100 |
| Projects | 2–3 projects, each with metric, strong verbs, relevant domain, no repetition | 100 |
| Experience | Reverse chronological, STAR bullets, metrics in every entry, no "worked on" | 100 |
| Education | Degree, institution, year present, relevant coursework if fresher | 100 |
| Formatting | No icons, no tables, no encoding errors, single column, no first-person | 100 |
| Keywords | JD must-have match %, role title in summary, domain terminology density | 100 |
| Metrics | % of bullets with quantified results | 100 |

### Deliverables
- `/src/pages/AnalyserPage.jsx`
- `/src/utils/sectionScorer.js`
- `/src/components/ScoreCard.jsx`
- `/src/components/SectionTable.jsx`
- `/src/components/FixSuggestion.jsx`

---

## Phase 6 — PDF Export (ATS-Safe)
**Goal:** One-click PDF download that is ATS-parseable, single-column, clean

### PDF Rules (hardcoded in template)
- Single column layout only
- Font: Arial or Times New Roman (system fonts, no web fonts)
- Size: 10–11pt body, 13pt section headings
- Margins: 0.7 inch all sides
- No header/footer area text (confuses ATS)
- No images, no tables, no icons
- All text selectable (not flattened)
- PDF metadata: title = "[Name] — [Role] Resume"
- File name: `[FirstName_LastName]_[Role]_Resume.pdf`

### Implementation
```javascript
// Using html2pdf.js
const opt = {
  margin: [0.7, 0.7, 0.7, 0.7],
  filename: `${firstName}_${lastName}_${role}_Resume.pdf`,
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: 'avoid-all' }
};
html2pdf().set(opt).from(resumeHTMLElement).save();
```

### Deliverables
- `/src/utils/pdfExport.js`
- `/src/templates/ResumeTemplate.jsx` (ATS-safe HTML template)

---

## Phase 7 — Application Tracker Kanban
**Goal:** Track every job application status in a drag-and-drop board

### Kanban Columns
```
SAVED → APPLIED → INTERVIEW → OFFER → REJECTED
```

### Card Data per Job
- Company name + role
- Applied date
- Resume version used (link to version in IndexedDB)
- ATS score + Human score achieved
- Notes field
- Next action + due date

### Deliverables
- `/src/pages/TrackerPage.jsx`
- `/src/components/KanbanBoard.jsx`
- `/src/components/JobCard.jsx`

---

## Phase 8 — LLM Provider Switcher
**Goal:** Let users plug in their own free API key for any supported provider

### Supported Providers
| Provider | Model | Free Tier | Speed |
|---|---|---|---|
| Groq | Llama 3 70B | 14,400 req/day | Very fast |
| Kimi (Moonshot) | moonshot-v1-8k | Limited free | Medium |
| Nvidia NIM | Llama 3 70B | $0.35 credit | Fast |
| Ollama | Any local model | Unlimited | Depends on hardware |
| OpenRouter | Many (free tier) | Varies | Medium |

### Provider Config UI
- Settings page: enter API key per provider
- Keys stored in localStorage (never sent to any server other than the chosen LLM)
- Auto-fallback: if Groq rate-limited, auto-switch to secondary

---

## Data Model (IndexedDB)

```javascript
// Database: JobSeekerOS, Version: 1

// Store: jobs
{
  id: uuid,
  url: string,
  company: string,
  role: string,
  seniority: string,
  mustHaveSkills: string[],
  niceToHaveSkills: string[],
  rawJD: string,
  summary: string,
  createdAt: timestamp,
  status: 'saved' | 'applied' | 'interview' | 'offer' | 'rejected'
}

// Store: baseResume
{
  id: 'base',
  rawText: string,
  parsedSections: object,
  experienceLevel: 'fresher' | 'experienced',
  updatedAt: timestamp
}

// Store: tailoredResumes
{
  id: uuid,
  jobId: string,         // references jobs.id
  resumeMarkdown: string,
  atsScore: number,
  humanScore: number,
  passed: boolean,
  attempt: number,
  sectionScores: object,
  createdAt: timestamp
}

// Store: applications
{
  id: uuid,
  jobId: string,
  resumeId: string,
  status: string,
  appliedDate: timestamp,
  notes: string,
  nextAction: string,
  nextActionDate: timestamp
}
```

---

## Build Session Map

Each session below is scoped to fit within a single Claude conversation (avoiding rate limit issues).

| Session | Phase | What you build | Estimated time |
|---|---|---|---|
| Session 1 | Phase 1 | Project scaffold + URL collector + dedup + Jina fetch | 45 min |
| Session 2 | Phase 1 cont. | LLM JD parser + IndexedDB store + .md export | 45 min |
| Session 3 | Phase 2 | Resume uploader + parser + tailoring prompt engine | 60 min |
| Session 4 | Phase 2 cont. | Tailoring output renderer + version storage | 30 min |
| Session 5 | Phase 3 | ATS rule engine + scoring UI | 45 min |
| Session 6 | Phase 4 | Human scorer LLM prompt + score gate logic | 45 min |
| Session 7 | Phase 5 | Section analyser dashboard + fix suggestions | 60 min |
| Session 8 | Phase 6 | PDF export + ATS-safe template | 45 min |
| Session 9 | Phase 7 | Application tracker kanban | 45 min |
| Session 10 | Phase 8 | LLM provider switcher + settings page | 30 min |
| Session 11 | Polish | Responsive layout, dark mode, error states | 45 min |
| Session 12 | Testing | End-to-end test with real job links + real resume | 60 min |

---

## Folder Structure

```
job-seeker-os/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── KanbanBoard.jsx
│   │   ├── JobCard.jsx
│   │   ├── ScoreCard.jsx
│   │   ├── SectionTable.jsx
│   │   └── FixSuggestion.jsx
│   ├── pages/
│   │   ├── CollectorPage.jsx
│   │   ├── TailorPage.jsx
│   │   ├── AnalyserPage.jsx
│   │   ├── TrackerPage.jsx
│   │   └── SettingsPage.jsx
│   ├── utils/
│   │   ├── dedup.js
│   │   ├── jinaFetch.js
│   │   ├── jdParser.js
│   │   ├── resumeParser.js
│   │   ├── tailorPrompt.js
│   │   ├── atsScorer.js
│   │   ├── humanScorer.js
│   │   ├── sectionScorer.js
│   │   ├── pdfExport.js
│   │   └── versionStore.js
│   ├── store/
│   │   ├── jobStore.js         ← IndexedDB wrapper
│   │   └── llmProvider.js      ← API key + provider config
│   ├── templates/
│   │   └── ResumeTemplate.jsx  ← ATS-safe HTML/CSS template
│   └── App.jsx
├── package.json
└── README.md
```

---

## Resume Protocol Reference (from uploaded file)

These rules are hardcoded into the tailoring prompt and ATS scoring engine. They are non-negotiable.

### Structure Order (LOCKED)
1. Header (Name + Contact)
2. Summary
3. Skills
4. Projects
5. Experience
6. Education
7. Certifications (optional)

### Never Include
- Declaration · Date of Birth · Father's Name · Hobbies · Photo

### Bullet Formula (MANDATORY)
`[Strong Verb] + [What you built/did] + [Measurable Result]`

### Banned Verbs
Worked · Learned · Gained knowledge · Assisted · Helped

### Required Strong Verbs
Built · Developed · Designed · Implemented · Optimized · Architected · Automated

### Design: ATS Critical
- Single column only
- No icons, no tables, no graphics, no multi-column
- Font: Arial / Times New Roman / Calibri, 10–11pt
- Margins: 0.6–0.8 inch

### Length
- Fresher: STRICTLY 1 page
- Experienced: max 2 pages

### Customization
- Modify only 5–10% keywords per job
- One resume = ONE target role

### Final Golden Rule
> Resume is NOT about showing everything you know.
> It is about making the recruiter say "this person fits this role" in 6 seconds.

---

## Known Risks & Mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Jina blocked by job site | High (40–60% of links) | Manual JD paste fallback, always shown as option |
| Groq rate limit hit during batch | Medium | 1.5s delay between calls, session cap of 20 jobs |
| LLM returns malformed JSON | Medium | JSON repair function + retry once before fallback to template |
| ATS score never reaches 90 after 3 attempts | Low | Cap retries at 3, show breakdown, let user manually edit |
| PDF not parseable by ATS | Low | ATS-safe template enforced in HTML → no tables, no columns |
| IndexedDB full | Very low | Warn user at 80% capacity, offer export + clear |

---

## Unique Differentiators (vs existing tools)

| Feature | This tool | Jobscan | Resume.io | LinkedIn |
|---|---|---|---|---|
| End-to-end pipeline | ✅ | ❌ | ❌ | ❌ |
| 100% free | ✅ | ❌ | ❌ | ❌ |
| Offline capable | ✅ | ❌ | ❌ | ❌ |
| Section-level scoring | ✅ | Partial | ❌ | ❌ |
| Custom protocol rules | ✅ | ❌ | ❌ | ❌ |
| Application tracker | ✅ | ❌ | ❌ | Partial |
| Retry loop with feedback | ✅ | ❌ | ❌ | ❌ |

---

*Document version: 1.0 · Built for: Job Seeker OS Project*
