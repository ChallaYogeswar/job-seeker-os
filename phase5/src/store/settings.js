const STORAGE_KEY = 'jsos_settings';

const defaults = {
  provider: 'groq',
  apiKeys: {
    groq: '',
    openrouter: '',
    kimi: '',
    nvidia: '',
    ollama: '',
  },
  models: {
    groq:        'llama-3.3-70b-versatile',
    openrouter:  'meta-llama/llama-3.1-8b-instruct:free',
    kimi:        'moonshot-v1-8k',
    nvidia:      'meta/llama-3.1-70b-instruct',
    ollama:      'llama3',
  },
  autoFallback: true,
  requestDelay: 1500,
  sessionLimit: 20,
};

export function getSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...defaults };
    const parsed = JSON.parse(stored);
    // Deep merge to pick up any new defaults added in later versions
    return {
      ...defaults,
      ...parsed,
      apiKeys: { ...defaults.apiKeys, ...(parsed.apiKeys || {}) },
      models:  { ...defaults.models,  ...(parsed.models  || {}) },
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getApiKey(provider = null) {
  const settings = getSettings();
  const p = provider || settings.provider;
  return settings.apiKeys?.[p] || '';
}

export function getProvider() {
  return getSettings().provider || 'groq';
}

export function hasApiKey() {
  const settings = getSettings();
  if (settings.provider === 'ollama') return true; // no key needed
  const key = settings.apiKeys?.[settings.provider] || '';
  return key.trim().length > 0;
}

export function getModel(provider = null) {
  const settings = getSettings();
  const p = provider || settings.provider;
  return settings.models?.[p] || '';
}
