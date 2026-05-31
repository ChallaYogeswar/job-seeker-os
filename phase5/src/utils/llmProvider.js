/**
 * Unified LLM Provider Router
 * Supports: Groq, OpenRouter (free models), Kimi (Moonshot), Nvidia NIM, Ollama (local)
 * Auto-fallback: if primary hits rate limit, switches to next configured provider.
 */

import { getSettings } from '../store/settings.js';

// ─── Provider configs ─────────────────────────────────────────────────────────
export const PROVIDERS = {
  groq: {
    id: 'groq',
    label: 'Groq',
    badge: 'Recommended',
    model: 'llama-3.3-70b-versatile',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    free: true,
    freeNote: '14,400 req/day free tier',
    signupUrl: 'https://console.groq.com',
    supportsStream: true,
    supportsJsonMode: true,
    formatRequest: (messages, opts) => ({
      model: opts.model || 'llama-3.3-70b-versatile',
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2000,
      stream: opts.stream ?? false,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    badge: 'Free models',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    free: true,
    freeNote: 'Free tier — slower, rate-limited',
    signupUrl: 'https://openrouter.ai',
    supportsStream: true,
    supportsJsonMode: false,
    formatRequest: (messages, opts) => ({
      model: opts.model || 'meta-llama/llama-3.1-8b-instruct:free',
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2000,
      stream: opts.stream ?? false,
    }),
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    badge: 'Free tier',
    model: 'moonshot-v1-8k',
    apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
    modelsUrl: 'https://api.moonshot.cn/v1/models',
    free: true,
    freeNote: 'Limited free credits on signup',
    signupUrl: 'https://platform.moonshot.cn',
    supportsStream: false,
    supportsJsonMode: false,
    formatRequest: (messages, opts) => ({
      model: opts.model || 'moonshot-v1-8k',
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2000,
    }),
  },
  nvidia: {
    id: 'nvidia',
    label: 'Nvidia NIM',
    badge: 'Free credits',
    model: 'meta/llama-3.1-70b-instruct',
    apiUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    modelsUrl: null,
    free: true,
    freeNote: '$0.35 free credit on signup',
    signupUrl: 'https://build.nvidia.com',
    supportsStream: false,
    supportsJsonMode: false,
    formatRequest: (messages, opts) => ({
      model: opts.model || 'meta/llama-3.1-70b-instruct',
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2000,
    }),
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (Local)',
    badge: 'Offline',
    model: 'llama3',
    apiUrl: 'http://localhost:11434/api/chat',
    modelsUrl: 'http://localhost:11434/api/tags',
    free: true,
    freeNote: 'Runs on your machine — unlimited',
    signupUrl: 'https://ollama.com',
    supportsStream: false,
    supportsJsonMode: false,
    formatRequest: (messages, opts) => ({
      model: opts.model || 'llama3',
      messages,
      stream: false,
    }),
  },
};

// ─── Core call function ───────────────────────────────────────────────────────
export async function callLLM({
  messages,
  provider: forceProvider,
  temperature = 0.3,
  maxTokens = 2000,
  jsonMode = false,
  stream = false,
  onStream = null,
}) {
  const settings = getSettings();
  const primaryId = forceProvider || settings.provider || 'groq';

  // Build fallback chain: primary first, then others that have keys
  const fallbackOrder = [primaryId, ...Object.keys(PROVIDERS).filter(id => {
    if (id === primaryId) return false;
    if (id === 'ollama') return true; // ollama needs no key
    return !!(settings.apiKeys?.[id]);
  })];

  let lastError = null;

  for (const providerId of fallbackOrder) {
    const cfg = PROVIDERS[providerId];
    const apiKey = providerId === 'ollama' ? null : settings.apiKeys?.[providerId];

    if (providerId !== 'ollama' && !apiKey) continue;

    try {
      const result = await callSingleProvider({
        cfg, apiKey, messages,
        temperature, maxTokens, jsonMode,
        stream: stream && cfg.supportsStream,
        onStream,
      });
      if (result) return { text: result, provider: providerId };
    } catch (err) {
      lastError = err;
      const isRateLimit = err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit');
      const isAuth = err.message?.includes('401') || err.message?.toLowerCase().includes('invalid api key');

      if (isAuth) throw new Error(`Invalid API key for ${cfg.label}. Check Settings.`);
      if (isRateLimit && settings.autoFallback) {
        console.warn(`[LLM] ${cfg.label} rate-limited, trying next provider...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('No LLM provider available. Add an API key in Settings.');
}

async function callSingleProvider({ cfg, apiKey, messages, temperature, maxTokens, jsonMode, stream, onStream }) {
  const body = cfg.formatRequest(messages, { temperature, maxTokens, jsonMode, stream });

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    ...(cfg.id === 'openrouter' ? { 'HTTP-Referer': 'https://jobseekeros.app', 'X-Title': 'Job Seeker OS' } : {}),
  };

  const res = await fetch(cfg.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `HTTP ${res.status}`);
  }

  // ── Streaming (Groq / OpenRouter) ──────────────────────────────────────────
  if (stream && onStream) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const delta = JSON.parse(data)?.choices?.[0]?.delta?.content || '';
          if (delta) { full += delta; onStream(full); }
        } catch { /* skip malformed */ }
      }
    }
    return full.trim();
  }

  // ── Ollama response format ─────────────────────────────────────────────────
  if (cfg.id === 'ollama') {
    const data = await res.json();
    return data?.message?.content?.trim() || '';
  }

  // ── Standard OpenAI-compatible ────────────────────────────────────────────
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Test connection for a provider ──────────────────────────────────────────
export async function testProvider(providerId, apiKey) {
  const cfg = PROVIDERS[providerId];
  if (!cfg) return { ok: false, message: 'Unknown provider' };

  // Ollama — check local server
  if (providerId === 'ollama') {
    try {
      const res = await fetch(cfg.modelsUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        const models = data?.models?.map(m => m.name).slice(0, 3).join(', ') || 'none';
        return { ok: true, message: `Ollama running · models: ${models}` };
      }
      return { ok: false, message: 'Ollama not running. Start with: ollama serve' };
    } catch {
      return { ok: false, message: 'Cannot reach localhost:11434 — is Ollama running?' };
    }
  }

  if (!apiKey?.trim()) return { ok: false, message: 'No API key entered' };

  if (cfg.modelsUrl) {
    try {
      const res = await fetch(cfg.modelsUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return { ok: true, message: `${cfg.label} connected ✓` };
      if (res.status === 401) return { ok: false, message: 'Invalid API key (401)' };
      return { ok: false, message: `Unexpected status: ${res.status}` };
    } catch (err) {
      return { ok: false, message: `Connection failed: ${err.message}` };
    }
  }

  // Providers without a models endpoint — do a minimal chat call
  try {
    const res = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(cfg.formatRequest([{ role: 'user', content: 'Hi' }], { maxTokens: 5 })),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return { ok: true, message: `${cfg.label} connected ✓` };
    if (res.status === 401) return { ok: false, message: 'Invalid API key' };
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}
