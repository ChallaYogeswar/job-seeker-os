/**
 * Human Recruiter Scorer
 * Evaluates the resume from a recruiter's 6-second scan perspective.
 * Uses Groq LLM with a strict structured rubric. Returns JSON score breakdown.
 *
 * Pass threshold: 85+
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const HUMAN_SCORE_SYSTEM = `You are a senior technical recruiter with 10 years of hiring experience.
You evaluate resumes using the "6-second rule": a recruiter decides in 6 seconds whether to keep reading.
Score the resume using the rubric below. Return ONLY a valid JSON object — no markdown, no explanation.

RUBRIC (100 points total):

A. ABOVE-THE-FOLD IMPACT (30 pts) — what a recruiter sees in the first 6 seconds:
   - nameContactClear (0-5): Name and contact info visible at top, no hunting needed
   - summaryOpensWithRole (0-5): Summary first sentence names the target role explicitly
   - summaryShowsSpecialization (0-10): One clear domain/specialization immediately obvious
   - firstBulletHasMetric (0-10): The very first bullet of the first job/project has a strong metric

B. CLARITY AND READABILITY (25 pts):
   - bulletsUnderTwoLines (0-5): All bullets are concise, none exceed 2 lines
   - directConcreteLanguage (0-10): Language is specific and direct, no vague buzzwords or filler
   - sectionLabelsRecognizable (0-5): Standard section labels (Experience, not "Professional Journey")
   - noTemplateFiller (0-5): No generic filler like "results-oriented professional", "passionate about"

C. RELEVANCE SIGNAL (25 pts):
   - topSkillsPresent (0-10): Top 3 required skills from JD appear in Skills section
   - domainMatchStrong (0-10): Projects/experience clearly match the job domain
   - seniorityLevelFits (0-5): Candidate's experience level matches what the job requires

D. PROFESSIONAL POLISH (20 pts):
   - noTyposOrErrors (0-10): No grammatical errors, typos, or inconsistencies found
   - consistentTense (0-5): Past tense for past roles, consistent throughout
   - visualCleanliness (0-5): Clean layout implied by structure — no clutter, not over-bolded

For each check return: "score" (number) and "reason" (max 10 words, specific and actionable).

Also return:
- "topStrength": one sentence describing the strongest element
- "topWeakness": one sentence describing the most critical fix needed
- "verdict": "PASS" if totalScore >= 85, else "FAIL"`;

export async function scoreHuman(resumeText, jobData = {}, apiKey, provider = 'groq') {
  if (!apiKey) throw new Error('No API key for human scoring.');

  const prompt = `Score this resume for the role of ${jobData.role || 'Software Engineer'} at ${jobData.company || 'this company'}.

JOB CONTEXT:
Role: ${jobData.role}
Must-have skills: ${(jobData.mustHaveSkills || []).join(', ')}
Domain: ${jobData.domain}
Seniority: ${jobData.seniority}

RESUME:
${resumeText.slice(0, 4000)}

Return ONLY JSON matching this schema exactly:
{
  "totalScore": number,
  "sectionScores": {
    "aboveTheFold": {
      "total": number,
      "checks": {
        "nameContactClear": { "score": number, "reason": "string" },
        "summaryOpensWithRole": { "score": number, "reason": "string" },
        "summaryShowsSpecialization": { "score": number, "reason": "string" },
        "firstBulletHasMetric": { "score": number, "reason": "string" }
      }
    },
    "clarity": {
      "total": number,
      "checks": {
        "bulletsUnderTwoLines": { "score": number, "reason": "string" },
        "directConcreteLanguage": { "score": number, "reason": "string" },
        "sectionLabelsRecognizable": { "score": number, "reason": "string" },
        "noTemplateFiller": { "score": number, "reason": "string" }
      }
    },
    "relevance": {
      "total": number,
      "checks": {
        "topSkillsPresent": { "score": number, "reason": "string" },
        "domainMatchStrong": { "score": number, "reason": "string" },
        "seniorityLevelFits": { "score": number, "reason": "string" }
      }
    },
    "polish": {
      "total": number,
      "checks": {
        "noTyposOrErrors": { "score": number, "reason": "string" },
        "consistentTense": { "score": number, "reason": "string" },
        "visualCleanliness": { "score": number, "reason": "string" }
      }
    }
  },
  "topStrength": "string",
  "topWeakness": "string",
  "verdict": "PASS" | "FAIL"
}`;

  let response;
  if (provider === 'groq') {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: HUMAN_SCORE_SYSTEM },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });
  } else {
    throw new Error(`Provider "${provider}" not supported.`);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 429) throw new Error('Rate limit. Wait 60s.');
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from scorer');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('Could not parse human score JSON');
  }

  // Validate and clamp totalScore
  const total = Math.min(100, Math.max(0, parsed.totalScore || 0));
  return {
    ...parsed,
    totalScore: total,
    passed: total >= 85,
    verdict: total >= 85 ? 'PASS' : 'FAIL',
  };
}

/** Flat list of all checks for the analyser dashboard */
export function flattenHumanScores(humanResult) {
  if (!humanResult?.sectionScores) return [];
  const rows = [];
  const sectionLabels = {
    aboveTheFold: 'Above-the-Fold',
    clarity: 'Clarity',
    relevance: 'Relevance',
    polish: 'Polish',
  };
  const checkLabels = {
    nameContactClear: 'Name & contact clear',
    summaryOpensWithRole: 'Summary opens with role',
    summaryShowsSpecialization: 'Specialization obvious',
    firstBulletHasMetric: 'First bullet has metric',
    bulletsUnderTwoLines: 'Bullets concise',
    directConcreteLanguage: 'Direct language',
    sectionLabelsRecognizable: 'Clear section labels',
    noTemplateFiller: 'No filler text',
    topSkillsPresent: 'Top JD skills present',
    domainMatchStrong: 'Domain match',
    seniorityLevelFits: 'Seniority match',
    noTyposOrErrors: 'No typos/errors',
    consistentTense: 'Consistent tense',
    visualCleanliness: 'Visual cleanliness',
  };
  const maxScores = {
    nameContactClear: 5, summaryOpensWithRole: 5, summaryShowsSpecialization: 10,
    firstBulletHasMetric: 10, bulletsUnderTwoLines: 5, directConcreteLanguage: 10,
    sectionLabelsRecognizable: 5, noTemplateFiller: 5, topSkillsPresent: 10,
    domainMatchStrong: 10, seniorityLevelFits: 5, noTyposOrErrors: 10,
    consistentTense: 5, visualCleanliness: 5,
  };

  for (const [sectionKey, section] of Object.entries(humanResult.sectionScores)) {
    for (const [checkKey, check] of Object.entries(section.checks || {})) {
      const max = maxScores[checkKey] || 10;
      rows.push({
        section: sectionLabels[sectionKey] || sectionKey,
        check: checkLabels[checkKey] || checkKey,
        score: check.score,
        max,
        pct: Math.round((check.score / max) * 100),
        reason: check.reason,
        status: check.score >= max * 0.8 ? 'pass' : check.score >= max * 0.5 ? 'warn' : 'fail',
      });
    }
  }
  return rows;
}
