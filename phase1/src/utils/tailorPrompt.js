/**
 * Resume Tailoring Prompt Engine
 * Built from: RESUME WRITING PROTOCOL (FINAL SYSTEM)
 *
 * These rules are NON-NEGOTIABLE and hardcoded.
 * The LLM is instructed to NEVER deviate from them.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── System Prompt (Protocol Constitution) ───────────────────────────────────
const SYSTEM_PROMPT = `You are an expert resume tailoring engine. You follow a strict protocol with zero exceptions.

════════════════════════════════════════
RESUME WRITING PROTOCOL — RULES YOU NEVER BREAK
════════════════════════════════════════

▌STRUCTURE (LOCKED ORDER — DO NOT CHANGE):
1. HEADER   → Full Name + Email + Phone + LinkedIn + GitHub (no icons, no labels like "Email:")
2. SUMMARY  → 2–3 lines, role-specific, opens with the target job title by name
3. SKILLS   → Grouped exactly: Programming Languages | Core CS Fundamentals | Tools & Technologies | Platforms
4. PROJECTS → 2–3 most relevant, each with 2–3 bullets
5. EXPERIENCE → Reverse chronological, each role with 2–3 bullets
6. EDUCATION → Degree | Institution | Year | CGPA if strong (≥7.5/10 or ≥3.5/4.0)
7. CERTIFICATIONS → Only if directly relevant to this job (omit if none)

▌NEVER INCLUDE:
- Declaration, Date of Birth, Father's Name, Hobbies, Photo, Marital Status
- These will immediately mark the resume as unprofessional

▌BULLET FORMULA (EVERY SINGLE BULLET):
→ [Strong Verb] + [What you built/did] + [Measurable result]
Example: "Developed IoT automation system reducing manual effort by 25%"
Example: "Built face recognition model achieving 92% accuracy on 5K test images"

▌STRONG VERBS — ALWAYS USE THESE:
Built | Developed | Designed | Implemented | Optimized | Architected | Automated
Engineered | Created | Launched | Deployed | Reduced | Increased | Improved | Delivered

▌BANNED VERBS — NEVER USE:
Worked | Learned | Gained | Helped | Assisted | Participated | Was responsible for

▌METRICS RULE (NON-NEGOTIABLE):
Every project bullet must include at least one of:
- Percentage: "reducing latency by 40%"
- Accuracy: "achieving 94% precision"
- Scale: "processing 10K+ records"
- Time: "cutting build time from 12min to 3min"
- Count: "serving 500+ concurrent users"
If base resume has no metrics, INVENT plausible, conservative ones that fit the context.

▌ROLE CLARITY (CRITICAL):
- ONE target role per resume. Pick it from the job description.
- Summary MUST open with: "[Role Title] with [X years/months] of experience in [domain]..."
- Do NOT mix unrelated domains (AI + IoT + Analyst = confusing)

▌KEYWORD INJECTION (5–10 keywords per job):
- Extract 5–10 critical keywords from the job description
- Weave them naturally into Summary, Skills, and bullets
- Do not paste them randomly — context must make sense

▌ATS SAFETY (CRITICAL):
- Single column text ONLY
- NO icons, symbols, emojis, or special characters (no ☎ ✉ 📍 → use plain text)
- NO tables, NO multi-column, NO graphics
- NO encoding artifacts (¡ Ó ƍ ¯ — these crash ATS parsers)
- NO first-person ("I built" → "Built")
- Font will be: Arial or Times New Roman, 10–11pt (handled by PDF renderer)

▌LENGTH:
- Fresher (0–2 years experience): STRICTLY 1 page → max ~450 words total
- Experienced (3+ years): max 2 pages → max ~900 words total
- NO long paragraphs. Bullets only in body sections.

▌CUSTOMIZATION:
- Modify 5–10% of keywords from base resume to match this job
- Keep authentic experience — enhance framing, not fabricate
- Do NOT rewrite everything — adapt strategically

════════════════════════════════════════
OUTPUT FORMAT — FOLLOW EXACTLY
════════════════════════════════════════

Return the complete resume in clean Markdown. No preamble. No explanation. No comments.
Start with the header. End with Education or Certifications.

Use this exact structure:
---
[FULL NAME]
[email] | [phone] | [linkedin] | [github]

## SUMMARY
[2-3 sentence summary]

## SKILLS
**Programming Languages:** ...
**Core CS Fundamentals:** ...
**Tools & Technologies:** ...
**Platforms:** ...

## PROJECTS
**[Project Name]** | [Tech Stack] | [Year]
- [Bullet 1: Verb + What + Metric]
- [Bullet 2: Verb + What + Metric]

**[Project Name]** | [Tech Stack] | [Year]
- [Bullet 1]
- [Bullet 2]

## EXPERIENCE
**[Job Title]** | [Company] | [Month Year – Month Year]
- [Bullet 1]
- [Bullet 2]

## EDUCATION
**[Degree]** | [Institution] | [Year]
[CGPA if strong]

## CERTIFICATIONS (omit section entirely if none relevant)
- [Cert Name] | [Issuer] | [Year]
---

DO NOT deviate from this format. DO NOT add any text before or after the resume.`;

// ─── Build the user message ───────────────────────────────────────────────────
function buildUserMessage(parsedResume, job, experienceLevel, feedbackFromPrevAttempt = null) {
  const skillsBlock = job.mustHaveSkills?.length > 0
    ? `MUST-HAVE: ${job.mustHaveSkills.join(', ')}`
    : '';
  const niceBlock = job.niceToHaveSkills?.length > 0
    ? `NICE-TO-HAVE: ${job.niceToHaveSkills.join(', ')}`
    : '';

  let userMsg = `Tailor this resume for the following job. Follow the protocol EXACTLY.

════ TARGET JOB ════
Company: ${job.company}
Role: ${job.role}
Seniority: ${job.seniority}
Location: ${job.location}
Domain: ${job.domain}
${skillsBlock}
${niceBlock}
Key Requirements: ${job.keyRequirements?.join('; ') || 'Not specified'}
Job Summary: ${job.summary || 'Not provided'}

════ EXPERIENCE LEVEL ════
${experienceLevel === 'fresher' ? 'FRESHER (0-2 years) — STRICTLY 1 PAGE, max ~450 words' : 'EXPERIENCED (3+ years) — max 2 pages, ~900 words'}

════ BASE RESUME ════
${parsedResume.raw}`;

  if (feedbackFromPrevAttempt) {
    userMsg += `

════ PREVIOUS ATTEMPT FAILED — FIX THESE ISSUES ════
${feedbackFromPrevAttempt}
Regenerate the full resume fixing all issues above.`;
  }

  return userMsg;
}

// ─── Main tailoring function ─────────────────────────────────────────────────
export async function tailorResume({
  parsedResume,
  job,
  experienceLevel = 'fresher',
  apiKey,
  provider = 'groq',
  feedbackFromPrevAttempt = null,
  onStream = null,
}) {
  if (!apiKey) throw new Error('No API key configured. Please add your Groq API key in Settings.');
  if (!parsedResume?.raw) throw new Error('No resume content found. Please upload your resume first.');

  const userMessage = buildUserMessage(parsedResume, job, experienceLevel, feedbackFromPrevAttempt);
  const useStreaming = !!onStream;

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        stream: useStreaming,
      }),
    });
  } else {
    throw new Error(`Provider "${provider}" not supported in this phase.`);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 429) throw new Error('Rate limit reached. Wait 60s and try again.');
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  // ── Streaming mode ──
  if (useStreaming) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            onStream(fullText);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    return fullText.trim();
  }

  // ── Non-streaming mode ──
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty response');
  return content.trim();
}

// ─── Build feedback prompt from scorer results ────────────────────────────────
export function buildFeedbackPrompt(atsResult, humanResult) {
  const issues = [];

  if (atsResult.score < 90) {
    if (atsResult.details.keywordScore < 18)
      issues.push(`Keyword match too low (${Math.round(atsResult.details.keywordScore)}/25). Add more must-have skills from the JD.`);
    if (atsResult.details.bulletScore < 18)
      issues.push(`Bullet quality too low (${Math.round(atsResult.details.bulletScore)}/25). Ensure every bullet has a strong verb + metric.`);
    if (atsResult.details.formattingScore < 16)
      issues.push('Formatting issues detected. Remove any icons, tables, or first-person language.');
    if (atsResult.details.structureScore < 14)
      issues.push('Section structure incorrect. Check required sections are present in correct order.');
    if (atsResult.details.lengthScore < 8)
      issues.push('Resume too long. Cut to fit within page limit.');
  }

  if (humanResult && humanResult.totalScore < 85) {
    const sections = humanResult.sectionScores || {};
    if (sections.aboveTheFold?.total < 22)
      issues.push('Above-the-fold impact weak. Summary must open with exact role title. First bullet must have a strong metric.');
    if (sections.clarity?.total < 18)
      issues.push('Clarity issues. Shorten bullets, remove generic filler like "passionate professional" or "results-oriented".');
    if (sections.relevance?.total < 18)
      issues.push('Relevance signal weak. Projects and experience must match the job domain more closely.');
    if (humanResult.topWeakness)
      issues.push(`Recruiter view: ${humanResult.topWeakness}`);
  }

  return issues.length > 0 ? issues.join('\n') : 'Minor improvements needed. Strengthen metrics and keyword density.';
}
