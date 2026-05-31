const STORAGE_KEY = 'jsos_settings';

const defaults = {
  provider: 'groq',
  apiKeys: {
    groq: '',
    kimi: '',
    nvidia: '',
  },
  autoFallback: true,
  requestDelay: 1500,
};

export function getSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaults, ...JSON.parse(stored) } : { ...defaults };
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
  const key = settings.apiKeys?.[settings.provider] || '';
  return key.trim().length > 0;
}
