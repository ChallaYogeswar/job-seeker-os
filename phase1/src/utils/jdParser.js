/**
 * Parses raw job description text into a structured job object
 * Uses Groq API (or configured provider) via the LLM provider store
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const PARSE_SYSTEM_PROMPT = `You are a job description parser. Extract structured information from job posting text.
Return ONLY a valid JSON object — no markdown fences, no explanation, no preamble.

JSON schema:
{
  "company": "Company name (string, or 'Unknown' if not found)",
  "role": "Job title/role (string)",
  "seniority": "fresher|junior|mid|senior|lead|unknown",
  "location": "Remote|On-site|Hybrid|Unknown",
  "employmentType": "Full-time|Part-time|Contract|Internship|Unknown",
  "summary": "2-3 sentence summary of the role (string)",
  "mustHaveSkills": ["skill1", "skill2"],
  "niceToHaveSkills": ["skill1", "skill2"],
  "keyRequirements": ["requirement1", "requirement2"],
  "domain": "web|mobile|data|ml|devops|embedded|design|management|unknown",
  "yearsOfExperience": "0-1|1-3|3-5|5-8|8+|unknown"
}

Rules:
- mustHaveSkills: only explicitly required technical skills (max 10)
- niceToHaveSkills: bonus/preferred skills (max 8)  
- keyRequirements: non-skill requirements like "BS degree", "team leadership" (max 5)
- seniority: infer from title and experience required
- Keep summary factual and concise`;

export async function parseJobDescription(rawText, apiKey, provider = 'groq') {
  if (!apiKey) {
    throw new Error('No API key configured. Please add your Groq API key in Settings.');
  }

  const prompt = `Extract structured job information from this text:\n\n${rawText.slice(0, 6000)}`;

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
          { role: 'system', content: PARSE_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });
  } else {
    throw new Error(`Provider "${provider}" not yet supported.`);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw new Error('Rate limit reached. Wait 60 seconds and try again, or reduce batch size.');
    }
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error('LLM returned empty response');

  // Parse and validate
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON from response if it has surrounding text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not parse LLM response as JSON');
    }
  }

  // Validate and fill defaults
  return {
    company: parsed.company || 'Unknown Company',
    role: parsed.role || 'Unknown Role',
    seniority: parsed.seniority || 'unknown',
    location: parsed.location || 'Unknown',
    employmentType: parsed.employmentType || 'Full-time',
    summary: parsed.summary || '',
    mustHaveSkills: Array.isArray(parsed.mustHaveSkills) ? parsed.mustHaveSkills : [],
    niceToHaveSkills: Array.isArray(parsed.niceToHaveSkills) ? parsed.niceToHaveSkills : [],
    keyRequirements: Array.isArray(parsed.keyRequirements) ? parsed.keyRequirements : [],
    domain: parsed.domain || 'unknown',
    yearsOfExperience: parsed.yearsOfExperience || 'unknown',
  };
}
