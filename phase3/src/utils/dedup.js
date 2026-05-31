/**
 * Normalizes and deduplicates a list of job URLs.
 * Returns { unique: string[], duplicates: string[], invalid: string[] }
 */
export function deduplicateUrls(rawInput) {
  // Split by newlines, commas, spaces
  const lines = rawInput
    .split(/[\n,]+/)
    .map(l => l.trim())
    .filter(Boolean);

  const seen = new Map(); // normalized → original
  const duplicates = [];
  const invalid = [];
  const unique = [];

  for (const line of lines) {
    // Basic URL validation
    let normalized;
    try {
      const url = new URL(line);
      // Normalize: remove trailing slash, remove common tracking params
      url.searchParams.delete('utm_source');
      url.searchParams.delete('utm_medium');
      url.searchParams.delete('utm_campaign');
      url.searchParams.delete('ref');
      url.searchParams.delete('source');
      url.hash = '';
      normalized = url.toString().replace(/\/$/, '');
    } catch {
      invalid.push(line);
      continue;
    }

    if (seen.has(normalized)) {
      duplicates.push(line);
    } else {
      seen.set(normalized, line);
      unique.push(normalized);
    }
  }

  return { unique, duplicates, invalid };
}

/**
 * Generates a stable ID from a URL string
 */
export function urlToId(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extracts domain name from URL for display
 */
export function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}
