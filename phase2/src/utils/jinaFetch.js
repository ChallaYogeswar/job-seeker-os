const JINA_BASE = 'https://r.jina.ai/';
const DELAY_MS = 1500; // Rate limit protection

/**
 * Fetches clean text from a URL via Jina Reader API
 * Returns { success, text, error }
 */
export async function fetchViaJina(url) {
  try {
    const jinaUrl = `${JINA_BASE}${encodeURIComponent(url)}`;
    const res = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { success: false, text: null, error: `HTTP ${res.status}` };
    }

    const text = await res.text();

    // Check if we got meaningful content (not a bot block or empty page)
    if (!text || text.length < 200) {
      return { success: false, text: null, error: 'Page returned insufficient content — likely bot-blocked' };
    }

    // Check for common block indicators
    const lowerText = text.toLowerCase();
    if (
      lowerText.includes('access denied') ||
      lowerText.includes('403 forbidden') ||
      lowerText.includes('captcha') ||
      lowerText.includes('please enable javascript') ||
      lowerText.includes('sign in to view')
    ) {
      return { success: false, text: null, error: 'Page is behind a login or bot protection' };
    }

    return { success: true, text: cleanText(text), error: null };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { success: false, text: null, error: 'Request timed out (15s)' };
    }
    return { success: false, text: null, error: err.message };
  }
}

/**
 * Cleans raw Jina output — removes navigation noise, excessive whitespace
 */
function cleanText(raw) {
  return raw
    .replace(/\[.*?\]\(.*?\)/g, '') // remove markdown links
    .replace(/!\[.*?\]\(.*?\)/g, '') // remove image refs
    .replace(/={3,}/g, '') // remove dividers
    .replace(/\n{3,}/g, '\n\n') // collapse blank lines
    .replace(/^\s*(Home|Menu|Navigation|Skip to|Cookie|Privacy Policy|Terms).*/gim, '')
    .trim()
    .slice(0, 8000); // cap at 8k chars for LLM context
}

/**
 * Sleep helper for rate limiting
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { DELAY_MS };
