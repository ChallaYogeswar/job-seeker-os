import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, Trash2, RefreshCw, Zap } from 'lucide-react';
import { getSettings, saveSettings } from '../store/settings';
import { PROVIDERS, testProvider } from '../utils/llmProvider';
import { toast } from '../components/Toast';
import { getAllJobs, clearAllJobs } from '../store/db';
import { getAllTailoredResumes } from '../store/resumeStore';
import { getAllApplications } from '../store/applicationStore';

export default function SettingsPage() {
  const [settings, setSettings] = useState(getSettings());
  const [showKeys, setShowKeys] = useState({});
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [tab, setTab] = useState('providers');
  const [storageStats, setStorageStats] = useState(null);

  useEffect(() => {
    if (tab === 'data') loadStorageStats();
  }, [tab]);

  const loadStorageStats = async () => {
    const [jobs, resumes] = await Promise.all([getAllJobs(), getAllTailoredResumes()]);
    let apps = [];
    try { apps = await getAllApplications(); } catch {}
    setStorageStats({ jobs: jobs.length, resumes: resumes.length, apps: apps.length });
  };

  const updateKey = (provider, value) => setSettings(prev => ({
    ...prev,
    apiKeys: { ...prev.apiKeys, [provider]: value },
  }));

  const updateModel = (provider, value) => setSettings(prev => ({
    ...prev,
    models: { ...(prev.models || {}), [provider]: value },
  }));

  const handleSave = () => {
    saveSettings(settings);
    toast('Settings saved', 'success');
  };

  const handleTest = async (providerId) => {
    setTesting(prev => ({ ...prev, [providerId]: true }));
    setTestResults(prev => ({ ...prev, [providerId]: null }));
    const key = settings.apiKeys?.[providerId] || '';
    const result = await testProvider(providerId, key);
    setTestResults(prev => ({ ...prev, [providerId]: result }));
    setTesting(prev => ({ ...prev, [providerId]: false }));
    toast(result.message, result.ok ? 'success' : 'error');
  };

  const handleClearData = async (type) => {
    if (!window.confirm(`Clear all ${type}? This cannot be undone.`)) return;
    if (type === 'jobs') await clearAllJobs();
    toast(`All ${type} cleared`, 'info');
    loadStorageStats();
  };

  const providerOrder = ['groq', 'openrouter', 'kimi', 'nvidia', 'ollama'];

  return (
    <div style={{ padding: '40px', maxWidth: '680px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '6px' }}>
          CONFIGURATION
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: '6px' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '13px', lineHeight: 1.5 }}>
          API keys stored only in your browser. Never sent anywhere except the LLM provider you choose.
        </p>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {[
          { id: 'providers', label: 'LLM PROVIDERS' },
          { id: 'behavior',  label: 'BEHAVIOR' },
          { id: 'data',      label: 'DATA' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 18px', background: 'none', border: 'none',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px',
            letterSpacing: '0.08em', color: tab === t.id ? 'var(--accent)' : 'var(--text3)',
            marginBottom: '-1px',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Providers tab ─────────────────────────────────────────────────── */}
      {tab === 'providers' && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: '12px' }}>
            ACTIVE PROVIDER
          </div>
          {/* Provider selector cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
            {providerOrder.map(id => {
              const p = PROVIDERS[id];
              const isActive = settings.provider === id;
              const hasKey = id === 'ollama' || !!(settings.apiKeys?.[id]);
              return (
                <button key={id} onClick={() => setSettings(prev => ({ ...prev, provider: id }))} style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: isActive ? 'rgba(212,160,23,0.1)' : 'var(--bg2)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '6px', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text)' }}>
                      {p.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(34,197,94,0.1)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      {p.badge}
                    </span>
                    {hasKey && <span style={{ fontSize: '8px', color: 'var(--green)' }}>●</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>{p.freeNote}</div>
                </button>
              );
            })}
          </div>

          {/* Per-provider key + test */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: '12px' }}>
            API KEYS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {providerOrder.map(id => {
              const p = PROVIDERS[id];
              const isOllama = id === 'ollama';
              const key = settings.apiKeys?.[id] || '';
              const result = testResults[id];
              const isTesting = testing[id];
              return (
                <div key={id} style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', flex: 1, fontWeight: 500 }}>{p.label}</span>
                    {settings.provider === id && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent)', background: 'rgba(212,160,23,0.1)', padding: '1px 7px', borderRadius: '3px', border: '1px solid rgba(212,160,23,0.3)' }}>
                        ACTIVE
                      </span>
                    )}
                    <a href={p.signupUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text3)', display: 'flex' }}>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  {/* Key input */}
                  <div style={{ padding: '10px 14px', background: 'var(--bg)' }}>
                    {isOllama ? (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', lineHeight: 1.6 }}>
                        No API key needed.<br />
                        <span style={{ color: 'var(--text3)' }}>Requires Ollama running locally:</span>{' '}
                        <code style={{ color: 'var(--accent)', background: 'var(--bg2)', padding: '1px 6px', borderRadius: '3px' }}>ollama serve</code>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input
                            type={showKeys[id] ? 'text' : 'password'}
                            value={key}
                            onChange={e => updateKey(id, e.target.value)}
                            placeholder={`Paste ${p.label} API key...`}
                            style={{ ...inputStyle, width: '100%', paddingRight: '36px' }}
                          />
                          <button onClick={() => setShowKeys(prev => ({ ...prev, [id]: !prev[id] }))} style={{
                            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex',
                          }}>
                            {showKeys[id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                        <button onClick={() => handleTest(id)} disabled={isTesting} style={{
                          ...ghostBtn, whiteSpace: 'nowrap', opacity: isTesting ? 0.5 : 1,
                        }}>
                          {isTesting ? <Spinner /> : <Zap size={11} />}
                          {isTesting ? '...' : 'TEST'}
                        </button>
                      </div>
                    )}
                    {isOllama && (
                      <button onClick={() => handleTest('ollama')} disabled={testing.ollama} style={{ ...ghostBtn, marginTop: '8px' }}>
                        {testing.ollama ? <Spinner /> : <Zap size={11} />}
                        {testing.ollama ? 'Checking...' : 'CHECK LOCAL SERVER'}
                      </button>
                    )}
                    {result && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '7px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: result.ok ? 'var(--green)' : 'var(--red)' }}>
                        {result.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                        {result.message}
                      </div>
                    )}
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '5px' }}>
                      Model: <span style={{ color: 'var(--text2)' }}>{settings.models?.[id] || p.model}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Behavior tab ──────────────────────────────────────────────────── */}
      {tab === 'behavior' && (
        <div>
          <BehaviorRow
            label="Auto-fallback on rate limit"
            description="Automatically switch to next provider when current one is rate-limited"
            value={settings.autoFallback}
            onChange={v => setSettings(prev => ({ ...prev, autoFallback: v }))}
          />
          <BehaviorRow
            label="Request delay"
            description={`Pause between API calls to avoid rate limits (current: ${settings.requestDelay}ms)`}
            value={null}
          >
            <input type="range" min={500} max={5000} step={500}
              value={settings.requestDelay}
              onChange={e => setSettings(prev => ({ ...prev, requestDelay: +e.target.value }))}
              style={{ width: '160px', accentColor: 'var(--accent)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)', minWidth: '48px' }}>
              {settings.requestDelay}ms
            </span>
          </BehaviorRow>
          <BehaviorRow
            label="Session job limit"
            description={`Max jobs to process per batch (current: ${settings.sessionLimit || 20})`}
            value={null}
          >
            <input type="range" min={5} max={50} step={5}
              value={settings.sessionLimit || 20}
              onChange={e => setSettings(prev => ({ ...prev, sessionLimit: +e.target.value }))}
              style={{ width: '160px', accentColor: 'var(--accent)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)', minWidth: '28px' }}>
              {settings.sessionLimit || 20}
            </span>
          </BehaviorRow>
        </div>
      )}

      {/* ── Data tab ──────────────────────────────────────────────────────── */}
      {tab === 'data' && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: '12px' }}>
            STORAGE USAGE
          </div>
          {storageStats ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {[
                { label: 'Jobs', value: storageStats.jobs, key: 'jobs' },
                { label: 'Resume versions', value: storageStats.resumes, key: 'resumes' },
                { label: 'Applications', value: storageStats.apps, key: 'apps' },
              ].map(s => (
                <div key={s.key} style={{ padding: '14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 600, color: 'var(--text)' }}>{s.value}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '3px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text3)', marginBottom: '24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Spinner /> Loading stats...
            </div>
          )}

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: '12px' }}>
            CLEAR DATA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { key: 'jobs', label: 'Clear all stored jobs', description: 'Removes all collected job listings from Collector' },
              { key: 'all', label: 'Clear all data', description: 'Removes all jobs, resumes, applications — full reset' },
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>{item.description}</div>
                </div>
                <button onClick={() => handleClearData(item.key)} style={{ ...ghostBtn, color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}>
                  <Trash2 size={12} /> Clear
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', marginBottom: '6px', letterSpacing: '0.08em' }}>PRIVACY NOTE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', lineHeight: 1.7 }}>
              All data is stored exclusively in your browser (IndexedDB + localStorage).<br />
              Nothing is sent to any server except your chosen LLM provider when you generate resumes.<br />
              API keys never leave your browser. Clearing browser data also clears this app.
            </div>
          </div>
        </div>
      )}

      {/* Save button (not shown on data tab) */}
      {tab !== 'data' && (
        <button onClick={handleSave} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--accent)', color: '#000',
          border: 'none', borderRadius: '4px',
          padding: '11px 24px', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500,
          letterSpacing: '0.06em', marginTop: '24px',
          transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Save size={13} />
          SAVE SETTINGS
        </button>
      )}
    </div>
  );
}

function BehaviorRow({ label, description, value, onChange, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, paddingRight: '20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', marginBottom: '3px' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' }}>{description}</div>
      </div>
      {children || (
        <Toggle value={value} onChange={onChange} />
      )}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: '38px', height: '20px',
      background: value ? 'var(--accent)' : 'var(--bg4)',
      border: '1px solid var(--border2)', borderRadius: '10px',
      cursor: 'pointer', position: 'relative', flexShrink: 0,
      transition: 'background 0.2s',
    }}>
      <span style={{
        position: 'absolute', top: '2px', left: value ? '18px' : '2px',
        width: '14px', height: '14px',
        background: value ? '#000' : 'var(--text3)',
        borderRadius: '50%', transition: 'left 0.2s',
      }} />
    </button>
  );
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: '11px', height: '11px', border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />;
}

const inputStyle = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: '4px', padding: '7px 11px',
  color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none',
};

const ghostBtn = {
  display: 'flex', alignItems: 'center', gap: '5px',
  background: 'none', color: 'var(--text3)',
  border: '1px solid var(--border)', borderRadius: '4px',
  padding: '6px 12px', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '11px',
};
