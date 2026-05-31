/**
 * Section Analyser
 * Deep content-level analysis of each resume section.
 * Goes beyond the ATS rule engine — examines actual content quality,
 * bullet-by-bullet, section-by-section.
 */

const STRONG_VERBS = [
  'built','developed','designed','implemented','optimized','architected',
  'automated','engineered','created','launched','deployed','reduced',
  'increased','improved','delivered','led','managed','streamlined',
  'integrated','migrated','refactored','established','coordinated',
  'spearheaded','accelerated','transformed','consolidated','pioneered',
];

const BANNED_VERBS = [
  'worked','learned','gained','helped','assisted','participated',
  'was responsible','tried','attempted','supported','involved',
];

const FILLER_PHRASES = [
  'results-oriented','passionate about','hard-working','team player',
  'go-getter','self-starter','detail-oriented','proactive',
  'fast learner','excellent communication','strong interpersonal',
  'think outside the box','synergy','leverage','utilize',
];

const METRIC_PATTERN = /\d+\s*(%|x|K\+?|M\+?|ms|s\b|sec|hrs?|days?|weeks?|months?|records?|users?|requests?|concurrent|queries|transactions|accuracy|precision|recall|f1)/i;

const BANNED_SECTIONS = ['declaration','date of birth','father','hobbies','marital status','photo'];

// ─── Bullet annotator ────────────────────────────────────────────────────────
export function annotateBullets(text) {
  const bulletLines = (text.match(/^[-•*]\s.+/gm) || []).map(l => l.trim());
  return bulletLines.map(bullet => {
    const lower = bullet.toLowerCase();
    const cleaned = bullet.replace(/^[-•*]\s+/, '');
    const firstWord = cleaned.split(/\s+/)[0].toLowerCase();

    const hasStrongVerb = STRONG_VERBS.includes(firstWord);
    const hasBannedVerb = BANNED_VERBS.some(v => lower.startsWith(`- ${v}`) || lower.startsWith(`• ${v}`) || lower.startsWith(`* ${v}`) || lower.includes(` ${v} `));
    const hasMetric = METRIC_PATTERN.test(bullet);
    const wordCount = cleaned.split(/\s+/).length;
    const tooLong = wordCount > 25;
    const tooShort = wordCount < 8;
    const hasFiller = FILLER_PHRASES.some(f => lower.includes(f));
    const hasFirstPerson = /\b(i |i'm |my )\b/i.test(lower);

    const issues = [
      !hasStrongVerb && !hasBannedVerb && `Weak opener "${firstWord}" — use a strong verb`,
      hasBannedVerb && `Banned verb detected — replace with Built/Developed/Designed`,
      !hasMetric && 'No metric — add a number, %, or scale',
      tooLong && `Too long (${wordCount} words) — aim for 12–20 words`,
      tooShort && `Too short (${wordCount} words) — add more context`,
      hasFiller && 'Contains filler phrase — be specific',
      hasFirstPerson && 'First-person language — remove "I"',
    ].filter(Boolean);

    const score =
      (hasStrongVerb ? 35 : hasBannedVerb ? 0 : 15) +
      (hasMetric ? 40 : 0) +
      (!tooLong && !tooShort ? 15 : 5) +
      (!hasFiller ? 5 : 0) +
      (!hasFirstPerson ? 5 : 0);

    return {
      text: bullet,
      score: Math.min(100, score),
      grade: score >= 80 ? 'strong' : score >= 50 ? 'ok' : 'weak',
      hasStrongVerb,
      hasBannedVerb,
      hasMetric,
      tooLong,
      tooShort,
      hasFiller,
      hasFirstPerson,
      issues,
    };
  });
}

// ─── Header analyser ─────────────────────────────────────────────────────────
function analyseHeader(text) {
  const lower = text.toLowerCase();
  const hasEmail = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(text);
  const hasPhone = /(\+?\d[\d\s\-().]{7,}\d)/.test(text);
  const hasLinkedIn = /linkedin\.com\/in\//i.test(text);
  const hasGitHub = /github\.com\//i.test(text);
  const hasName = text.split('\n')[0]?.trim().length > 2;
  const hasIcons = /[☎✉📍📱🔗]/.test(text);
  const hasBannedInfo = BANNED_SECTIONS.some(b => lower.includes(b));
  const hasDOB = /date of birth|dob|d\.o\.b/i.test(text);
  const hasPhoto = /photo|picture|image/i.test(text);

  const checks = [
    { label: 'Full name present',        pass: hasName },
    { label: 'Email address',            pass: hasEmail },
    { label: 'Phone number',             pass: hasPhone },
    { label: 'LinkedIn URL',             pass: hasLinkedIn },
    { label: 'GitHub URL',               pass: hasGitHub },
    { label: 'No icons/symbols',         pass: !hasIcons },
    { label: 'No DOB or personal info',  pass: !hasDOB && !hasPhoto && !hasBannedInfo },
  ];

  const passed = checks.filter(c => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    section: 'Header',
    score,
    status: score >= 80 ? 'pass' : score >= 57 ? 'warn' : 'fail',
    checks,
    fixes: checks.filter(c => !c.pass).map(c => `Missing or fix: ${c.label}`),
    details: { hasEmail, hasPhone, hasLinkedIn, hasGitHub, hasName, hasIcons, hasBannedInfo },
  };
}

// ─── Summary analyser ────────────────────────────────────────────────────────
function analyseSummary(sectionText, jobRole = '') {
  const text = sectionText || '';
  const lower = text.toLowerCase();
  const lines = text.split('\n').filter(l => l.trim());
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const hasRoleTitle = jobRole
    ? lower.includes(jobRole.toLowerCase().split(' ')[0])
    : /engineer|developer|analyst|scientist|designer|manager|architect/i.test(text);
  const hasSpecialization = /\b(specialist|expert|focused on|specializing|with experience in)\b/i.test(text);
  const notTooLong = wordCount <= 60;
  const notTooShort = wordCount >= 15;
  const noFirstPerson = !/\b(I am|I have|I'm|My background)\b/i.test(text);
  const noFiller = !FILLER_PHRASES.some(f => lower.includes(f));
  const hasYearsExp = /\d+[\+]?\s*years?/i.test(text);
  const presentTense = text.length > 0;

  const checks = [
    { label: 'Opens with target role title',  pass: hasRoleTitle },
    { label: 'Shows clear specialization',    pass: hasSpecialization || hasRoleTitle },
    { label: 'Concise (15–60 words)',          pass: notTooLong && notTooShort },
    { label: 'No first-person language',       pass: noFirstPerson },
    { label: 'No filler phrases',             pass: noFiller },
    { label: 'Mentions years of experience',  pass: hasYearsExp },
  ];

  const passed = checks.filter(c => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    section: 'Summary',
    score,
    status: score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail',
    checks,
    fixes: checks.filter(c => !c.pass).map(c => `Fix: ${c.label}`),
    details: { wordCount, lines: lines.length },
  };
}

// ─── Skills analyser ─────────────────────────────────────────────────────────
function analyseSkills(sectionText, jobData = {}) {
  const text = sectionText || '';
  const lower = text.toLowerCase();

  const hasLanguages = /programming languages?|languages?:/i.test(text);
  const hasTools = /tools?|technologies|frameworks?/i.test(text);
  const hasPlatforms = /platforms?|cloud|infrastructure/i.test(text);
  const hasCS = /fundamentals?|algorithms?|data structures?|os|networking|dbms/i.test(text);
  const noSoftSkills = !/communication|teamwork|leadership|interpersonal|time management/i.test(text);
  const mustHave = (jobData.mustHaveSkills || []).map(s => s.toLowerCase());
  const matched = mustHave.filter(s => lower.includes(s));
  const matchRate = mustHave.length > 0 ? Math.round((matched.length / mustHave.length) * 100) : null;
  const hasGrouping = /\*\*|:/.test(text); // grouped with bold or colon

  const checks = [
    { label: 'Programming Languages group',  pass: hasLanguages },
    { label: 'Tools & Technologies group',   pass: hasTools },
    { label: 'Platforms group',              pass: hasPlatforms },
    { label: 'CS Fundamentals group',        pass: hasCS },
    { label: 'No soft skills mixed in',      pass: noSoftSkills },
    { label: 'Skills are grouped/labelled',  pass: hasGrouping },
    ...(mustHave.length > 0 ? [{ label: `JD keywords: ${matched.length}/${mustHave.length} matched`, pass: matchRate >= 60 }] : []),
  ];

  const passed = checks.filter(c => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    section: 'Skills',
    score,
    status: score >= 80 ? 'pass' : score >= 57 ? 'warn' : 'fail',
    checks,
    fixes: checks.filter(c => !c.pass).map(c => `Fix: ${c.label}`),
    details: { matchRate, matched, mustHaveMissing: mustHave.filter(s => !lower.includes(s)) },
  };
}

// ─── Projects analyser ────────────────────────────────────────────────────────
function analyseProjects(sectionText) {
  const text = sectionText || '';
  const bullets = annotateBullets(text);
  const projectHeaders = (text.match(/^\*\*[^*]+\*\*/gm) || []).concat(text.match(/^#{2,3}.+/gm) || []);
  const projectCount = projectHeaders.length || Math.max(1, Math.round(bullets.length / 3));

  const hasTechStack = /\|\s*[A-Z]|tech stack|built with|using/i.test(text);
  const hasYear = /20\d{2}/.test(text);
  const avgBulletScore = bullets.length > 0
    ? Math.round(bullets.reduce((s, b) => s + b.score, 0) / bullets.length)
    : 0;
  const metricRate = bullets.length > 0
    ? Math.round(bullets.filter(b => b.hasMetric).length / bullets.length * 100)
    : 0;
  const strongVerbRate = bullets.length > 0
    ? Math.round(bullets.filter(b => b.hasStrongVerb).length / bullets.length * 100)
    : 0;

  const checks = [
    { label: '2–3 projects present',         pass: projectCount >= 2 && projectCount <= 4 },
    { label: 'Tech stack mentioned',          pass: hasTechStack },
    { label: 'Year/date shown',               pass: hasYear },
    { label: 'Metrics in bullets (≥70%)',     pass: metricRate >= 70 },
    { label: 'Strong verbs used (≥70%)',      pass: strongVerbRate >= 70 },
    { label: 'Bullet quality avg ≥70',        pass: avgBulletScore >= 70 },
  ];

  const passed = checks.filter(c => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    section: 'Projects',
    score,
    status: score >= 80 ? 'pass' : score >= 57 ? 'warn' : 'fail',
    checks,
    fixes: checks.filter(c => !c.pass).map(c => `Fix: ${c.label}`),
    details: { projectCount, metricRate, strongVerbRate, avgBulletScore, bullets },
  };
}

// ─── Experience analyser ─────────────────────────────────────────────────────
function analyseExperience(sectionText) {
  const text = sectionText || '';
  const bullets = annotateBullets(text);

  const hasCompany = /\|\s*[A-Z]|at [A-Z]|\*\*[A-Z]/.test(text);
  const hasDates = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+20\d{2}/i.test(text) ||
    /20\d{2}\s*[-–]\s*(20\d{2}|present|current)/i.test(text);
  const hasTitle = /\*\*[^*]+\*\*|^[A-Z][a-z]+ (Engineer|Developer|Analyst|Intern|Manager)/m.test(text);
  const metricRate = bullets.length > 0
    ? Math.round(bullets.filter(b => b.hasMetric).length / bullets.length * 100)
    : 0;
  const strongVerbRate = bullets.length > 0
    ? Math.round(bullets.filter(b => b.hasStrongVerb).length / bullets.length * 100)
    : 0;
  const avgBulletScore = bullets.length > 0
    ? Math.round(bullets.reduce((s, b) => s + b.score, 0) / bullets.length)
    : 0;
  const noBannedVerbs = bullets.filter(b => b.hasBannedVerb).length === 0;

  const checks = [
    { label: 'Job title present',            pass: hasTitle || text.length > 10 },
    { label: 'Company name present',         pass: hasCompany || text.length > 10 },
    { label: 'Dates/duration shown',         pass: hasDates },
    { label: 'Metrics in bullets (≥70%)',    pass: metricRate >= 70 },
    { label: 'Strong verbs used (≥70%)',     pass: strongVerbRate >= 70 },
    { label: 'No banned verbs',             pass: noBannedVerbs },
  ];

  const passed = checks.filter(c => c.pass).length;
  const score = text.trim().length === 0 ? 0 : Math.round((passed / checks.length) * 100);

  return {
    section: 'Experience',
    score,
    status: score >= 80 ? 'pass' : score >= 57 ? 'warn' : 'fail',
    checks,
    fixes: checks.filter(c => !c.pass).map(c => `Fix: ${c.label}`),
    details: { metricRate, strongVerbRate, avgBulletScore, bullets, hasDates },
    isEmpty: text.trim().length === 0,
  };
}

// ─── Education analyser ───────────────────────────────────────────────────────
function analyseEducation(sectionText) {
  const text = sectionText || '';
  const hasDegree = /\b(b\.?tech|b\.?e\.?|b\.?sc|m\.?tech|m\.?sc|bachelor|master|phd|diploma|b\.?s\.|m\.?s\.)\b/i.test(text);
  const hasInstitution = /university|college|institute|school|iit|nit|bits/i.test(text);
  const hasYear = /20\d{2}/.test(text);
  const hasCGPA = /cgpa|gpa|percentage|%|\d+\.\d+\/\d+/i.test(text);
  const noPersonalInfo = !/(father|dob|date of birth|address|religion)/i.test(text);

  const checks = [
    { label: 'Degree name present',      pass: hasDegree },
    { label: 'Institution name',         pass: hasInstitution },
    { label: 'Graduation year',          pass: hasYear },
    { label: 'CGPA/GPA mentioned',       pass: hasCGPA },
    { label: 'No personal info mixed in', pass: noPersonalInfo },
  ];

  const passed = checks.filter(c => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    section: 'Education',
    score,
    status: score >= 80 ? 'pass' : score >= 57 ? 'warn' : 'fail',
    checks,
    fixes: checks.filter(c => !c.pass).map(c => `Fix: ${c.label}`),
    details: { hasDegree, hasInstitution, hasYear, hasCGPA },
  };
}

// ─── Master analyser ─────────────────────────────────────────────────────────
export function analyseResume(resumeText, jobData = {}) {
  const text = resumeText || '';
  const lower = text.toLowerCase();

  // Split text roughly into sections
  const sections = extractSections(text);

  const header     = analyseHeader(sections.header || text.split('\n').slice(0, 8).join('\n'));
  const summary    = analyseSummary(sections.summary || '', jobData.role || '');
  const skills     = analyseSkills(sections.skills || '', jobData);
  const projects   = analyseProjects(sections.projects || '');
  const experience = analyseExperience(sections.experience || '');
  const education  = analyseEducation(sections.education || '');

  // All bullets across the resume
  const allBullets = annotateBullets(text);
  const totalBullets = allBullets.length;
  const strongBullets = allBullets.filter(b => b.grade === 'strong').length;
  const weakBullets = allBullets.filter(b => b.grade === 'weak').length;
  const metricBullets = allBullets.filter(b => b.hasMetric).length;

  const sectionResults = [header, summary, skills, projects, experience, education];
  const overallScore = Math.round(
    sectionResults.reduce((s, r) => s + r.score, 0) / sectionResults.length
  );

  // System health: which areas need most work
  const weakestSections = [...sectionResults].sort((a, b) => a.score - b.score).slice(0, 2);
  const strongestSections = [...sectionResults].sort((a, b) => b.score - a.score).slice(0, 2);

  // Word count & length
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    overallScore,
    overallGrade: overallScore >= 80 ? 'STRONG' : overallScore >= 60 ? 'GOOD' : overallScore >= 40 ? 'WEAK' : 'POOR',
    sections: { header, summary, skills, projects, experience, education },
    sectionList: sectionResults,
    bullets: {
      all: allBullets,
      total: totalBullets,
      strong: strongBullets,
      weak: weakBullets,
      withMetric: metricBullets,
      metricRate: totalBullets > 0 ? Math.round(metricBullets / totalBullets * 100) : 0,
      strongRate: totalBullets > 0 ? Math.round(strongBullets / totalBullets * 100) : 0,
    },
    weakestSections,
    strongestSections,
    wordCount,
  };
}

// ─── Section text extractor ───────────────────────────────────────────────────
function extractSections(text) {
  const SECTION_PATTERNS = {
    summary:    /^(#{1,3}\s*)?(summary|professional summary|objective|profile|about)/im,
    skills:     /^(#{1,3}\s*)?(skills|technical skills|core competencies|technologies)/im,
    projects:   /^(#{1,3}\s*)?(projects|personal projects|academic projects|key projects)/im,
    experience: /^(#{1,3}\s*)?(experience|work experience|professional experience|internship)/im,
    education:  /^(#{1,3}\s*)?(education|academic background)/im,
    certifications: /^(#{1,3}\s*)?(certifications?|certificates?|achievements?)/im,
  };

  const lines = text.split('\n');
  const sectionStarts = {};

  lines.forEach((line, idx) => {
    for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(line) && !sectionStarts[key]) {
        sectionStarts[key] = idx;
      }
    }
  });

  const sortedStarts = Object.entries(sectionStarts).sort((a, b) => a[1] - b[1]);
  const result = {};

  // Header = lines before first section
  const firstSectionLine = sortedStarts[0]?.[1] ?? lines.length;
  result.header = lines.slice(0, firstSectionLine).join('\n');

  sortedStarts.forEach(([key, startLine], i) => {
    const nextStart = sortedStarts[i + 1]?.[1] ?? lines.length;
    result[key] = lines.slice(startLine, nextStart).join('\n');
  });

  return result;
}
