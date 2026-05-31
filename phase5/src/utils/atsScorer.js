/**
 * ATS Scorer — deterministic rule engine.
 * No LLM, no API. 100% reproducible.
 * Based on RESUME WRITING PROTOCOL (FINAL SYSTEM).
 *
 * Total: 100 points across 5 sections.
 * Pass threshold: 90+
 */

const STRONG_VERBS = [
  'built','developed','designed','implemented','optimized','architected',
  'automated','engineered','created','launched','deployed','reduced',
  'increased','improved','delivered','led','managed','streamlined',
  'integrated','migrated','refactored','established','coordinated',
];

const BANNED_VERBS = [
  'worked','learned','gained','helped','assisted','participated',
  'was responsible','tried','attempted','supported',
];

const REQUIRED_SECTIONS = ['summary','skills','projects','experience','education'];

const BANNED_CONTENT = [
  'declaration','date of birth','father','mother\'s name','hobbies',
  'marital status','nationality','religion','passport',
];

const ICON_PATTERN = /[\u2600-\u27BF\u2B50-\u2B55]|[\uD83C-\uDBFF\uDC00-\uDFFF]/u;
const ENCODING_PATTERN = /¡|Ó|ƍ|¯|â€|Ã|ð|â|ï|½|¾|¿/;
const FIRST_PERSON_PATTERN = /\b(I built|I designed|I developed|I created|I worked|I led|I managed|my project|my work)\b/i;
const TABLE_PATTERN = /\|.+\|.+\|/;
const METRIC_PATTERN = /\d+\s*(%|x|K\+?|M\+?|ms|s\b|sec|hrs?|days?|weeks?|months?|records?|users?|requests?|concurrent|queries|transactions|accuracy|precision|recall|f1)/i;

/**
 * Main scorer. Returns { score, grade, details, sectionBreakdown }
 */
export function scoreATS(resumeText, jobData = {}, experienceLevel = 'fresher') {
  const text = resumeText || '';
  const lowerText = text.toLowerCase();
  const details = {};

  // ── A: Structure (20 pts) ─────────────────────────────────────────────────
  const foundSections = REQUIRED_SECTIONS.filter(s => lowerText.includes(s));
  const sectionPresenceScore = (foundSections.length / REQUIRED_SECTIONS.length) * 14;

  // Check order: header should come before summary, skills before experience, etc.
  let orderScore = 6;
  const sectionPositions = {};
  for (const s of REQUIRED_SECTIONS) {
    sectionPositions[s] = lowerText.indexOf(s);
  }
  if (
    sectionPositions.summary > sectionPositions.skills ||
    sectionPositions.skills > sectionPositions.experience
  ) {
    orderScore = 2;
  }

  const bannedFound = BANNED_CONTENT.filter(b => lowerText.includes(b));
  const bannedPenalty = bannedFound.length * 3;

  const structureScore = Math.max(0, sectionPresenceScore + orderScore - bannedPenalty);

  details.structure = {
    score: Math.min(20, Math.round(structureScore)),
    max: 20,
    foundSections,
    missingSections: REQUIRED_SECTIONS.filter(s => !foundSections.includes(s)),
    bannedFound,
    orderOk: orderScore === 6,
  };

  // ── B: Keyword Match (25 pts) ──────────────────────────────────────────────
  const mustHave = (jobData.mustHaveSkills || []).map(s => s.toLowerCase());
  const niceToHave = (jobData.niceToHaveSkills || []).map(s => s.toLowerCase());

  const mustMatched = mustHave.filter(skill => lowerText.includes(skill));
  const niceMatched = niceToHave.filter(skill => lowerText.includes(skill));

  const mustScore = mustHave.length > 0
    ? (mustMatched.length / mustHave.length) * 18
    : 12; // no skills data → partial credit

  const niceScore = niceToHave.length > 0
    ? (niceMatched.length / niceToHave.length) * 4
    : 2;

  // Role title in summary section
  const summaryIdx = lowerText.indexOf('summary');
  const summaryEnd = Math.min(summaryIdx + 300, lowerText.length);
  const summaryText = summaryIdx >= 0 ? lowerText.slice(summaryIdx, summaryEnd) : '';
  const roleInSummary = jobData.role
    ? summaryText.includes(jobData.role.toLowerCase().split(' ')[0])
    : false;
  const roleTitleScore = roleInSummary ? 3 : 0;

  const keywordScore = Math.min(25, mustScore + niceScore + roleTitleScore);

  details.keywords = {
    score: Math.round(keywordScore),
    max: 25,
    mustHaveTotal: mustHave.length,
    mustHaveMatched: mustMatched.length,
    mustHaveMissing: mustHave.filter(s => !lowerText.includes(s)),
    niceMatched: niceMatched.length,
    roleInSummary,
  };

  // ── C: Bullet Quality (25 pts) ─────────────────────────────────────────────
  const bulletLines = text.match(/^[-•*]\s.+/gm) || [];
  const totalBullets = bulletLines.length;

  if (totalBullets === 0) {
    details.bullets = { score: 0, max: 25, totalBullets: 0, strongVerbCount: 0, metricCount: 0, bannedVerbCount: 0 };
  } else {
    const strongVerbBullets = bulletLines.filter(b =>
      STRONG_VERBS.some(v => b.toLowerCase().match(new RegExp(`^[-•*]\\s+${v}\\b`)))
    );
    const metricBullets = bulletLines.filter(b => METRIC_PATTERN.test(b));
    const bannedVerbBullets = bulletLines.filter(b =>
      BANNED_VERBS.some(v => b.toLowerCase().includes(v))
    );

    const verbScore = (strongVerbBullets.length / totalBullets) * 12;
    const metricScore = (metricBullets.length / totalBullets) * 12;
    const bannedPenalty2 = (bannedVerbBullets.length / totalBullets) * 4;
    const bulletScore = Math.max(0, Math.min(25, verbScore + metricScore - bannedPenalty2 + 1));

    details.bullets = {
      score: Math.round(bulletScore),
      max: 25,
      totalBullets,
      strongVerbCount: strongVerbBullets.length,
      metricCount: metricBullets.length,
      bannedVerbCount: bannedVerbBullets.length,
      metricRate: Math.round((metricBullets.length / totalBullets) * 100),
      verbRate: Math.round((strongVerbBullets.length / totalBullets) * 100),
      bulletsWithoutMetric: bulletLines.filter(b => !METRIC_PATTERN.test(b)).slice(0, 3),
    };
  }

  // ── D: ATS Formatting (20 pts) ────────────────────────────────────────────
  const hasIcons = ICON_PATTERN.test(text);
  const hasTable = TABLE_PATTERN.test(text);
  const hasEncoding = ENCODING_PATTERN.test(text);
  const hasFirstPerson = FIRST_PERSON_PATTERN.test(text);
  const hasMultiColumn = /\t{2,}/.test(text) || /  {4,}[A-Z]/.test(text);

  const formattingScore =
    (!hasIcons ? 5 : 0) +
    (!hasTable ? 4 : 0) +
    (!hasEncoding ? 5 : 0) +
    (!hasFirstPerson ? 4 : 0) +
    (!hasMultiColumn ? 2 : 0);

  details.formatting = {
    score: formattingScore,
    max: 20,
    hasIcons,
    hasTable,
    hasEncoding,
    hasFirstPerson,
    hasMultiColumn,
    issues: [
      hasIcons && 'Icons/emoji detected — ATS cannot parse these',
      hasTable && 'Table/pipe formatting detected — breaks ATS',
      hasEncoding && 'Encoding artifacts found (¡ Ó ƍ) — corrupts ATS parsing',
      hasFirstPerson && 'First-person writing found — convert to action verbs',
      hasMultiColumn && 'Possible multi-column layout — use single column',
    ].filter(Boolean),
  };

  // ── E: Length (10 pts) ────────────────────────────────────────────────────
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const maxWords = experienceLevel === 'fresher' ? 450 : 900;
  const minWords = experienceLevel === 'fresher' ? 200 : 350;

  let lengthScore;
  if (wordCount < minWords) {
    lengthScore = Math.round((wordCount / minWords) * 6);
  } else if (wordCount <= maxWords) {
    lengthScore = 10;
  } else {
    const overBy = wordCount - maxWords;
    lengthScore = Math.max(0, 10 - Math.floor(overBy / 40));
  }

  details.length = {
    score: lengthScore,
    max: 10,
    wordCount,
    maxWords,
    minWords,
    estimatedPages: Math.ceil(wordCount / 450),
    status: wordCount < minWords ? 'too_short' : wordCount > maxWords ? 'too_long' : 'ok',
  };

  // ── Total ─────────────────────────────────────────────────────────────────
  const totalScore = Math.min(100, Math.max(0, Math.round(
    details.structure.score +
    details.keywords.score +
    details.bullets.score +
    details.formatting.score +
    details.length.score
  )));

  const grade =
    totalScore >= 90 ? 'PASS' :
    totalScore >= 75 ? 'NEAR' :
    totalScore >= 60 ? 'WEAK' : 'FAIL';

  return {
    score: totalScore,
    grade,
    passed: totalScore >= 90,
    details,
    experienceLevel,
  };
}

/**
 * Per-section scores for the analyser dashboard.
 * Returns an array of { section, score, status, fixes }
 */
export function getSectionBreakdown(resumeText, jobData = {}) {
  const ats = scoreATS(resumeText, jobData);
  const d = ats.details;

  return [
    {
      section: 'Structure',
      score: Math.round((d.structure.score / 20) * 100),
      raw: d.structure.score,
      max: 20,
      status: d.structure.score >= 16 ? 'pass' : d.structure.score >= 10 ? 'warn' : 'fail',
      fixes: [
        d.structure.missingSections.length > 0 && `Missing: ${d.structure.missingSections.join(', ')}`,
        !d.structure.orderOk && 'Sections out of order. Must be: Summary → Skills → Projects → Experience → Education',
        d.structure.bannedFound.length > 0 && `Remove banned sections: ${d.structure.bannedFound.join(', ')}`,
      ].filter(Boolean),
    },
    {
      section: 'Keywords',
      score: Math.round((d.keywords.score / 25) * 100),
      raw: d.keywords.score,
      max: 25,
      status: d.keywords.score >= 20 ? 'pass' : d.keywords.score >= 14 ? 'warn' : 'fail',
      fixes: [
        d.keywords.mustHaveMissing?.length > 0 && `Add missing must-have skills: ${d.keywords.mustHaveMissing.slice(0, 4).join(', ')}`,
        !d.keywords.roleInSummary && 'Target role title not found in Summary section',
      ].filter(Boolean),
    },
    {
      section: 'Bullet Quality',
      score: Math.round((d.bullets.score / 25) * 100),
      raw: d.bullets.score,
      max: 25,
      status: d.bullets.score >= 20 ? 'pass' : d.bullets.score >= 13 ? 'warn' : 'fail',
      fixes: [
        d.bullets.metricRate < 70 && `Only ${d.bullets.metricRate}% of bullets have metrics. Add numbers to every bullet.`,
        d.bullets.verbRate < 70 && `Only ${d.bullets.verbRate}% use strong verbs. Replace weak verbs with: Built, Developed, Designed...`,
        d.bullets.bannedVerbCount > 0 && `${d.bullets.bannedVerbCount} bullet(s) use banned verbs (worked, learned, helped). Fix these.`,
      ].filter(Boolean),
    },
    {
      section: 'ATS Formatting',
      score: Math.round((d.formatting.score / 20) * 100),
      raw: d.formatting.score,
      max: 20,
      status: d.formatting.score >= 16 ? 'pass' : d.formatting.score >= 10 ? 'warn' : 'fail',
      fixes: d.formatting.issues,
    },
    {
      section: 'Length',
      score: Math.round((d.length.score / 10) * 100),
      raw: d.length.score,
      max: 10,
      status: d.length.score >= 8 ? 'pass' : d.length.score >= 5 ? 'warn' : 'fail',
      fixes: [
        d.length.status === 'too_long' && `${d.length.wordCount} words (max ${d.length.maxWords}). Cut ${d.length.wordCount - d.length.maxWords} words.`,
        d.length.status === 'too_short' && `Only ${d.length.wordCount} words — resume seems incomplete.`,
      ].filter(Boolean),
    },
  ];
}
