import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { getSettings, saveSettings } from '../store/settings';
import { toast } from '../components/Toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState(getSettings());
  const [showKeys, setShowKeys] = useState({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const updateKey = (provider, value) => {
    setSettings(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: value },
    }));
  };

  const handleSave = () => {
    saveSettings(settings);
    toast('Settings saved', 'success');
  };

  const testGroq = async () => {
    const key = settings.apiKeys.groq;
    if (!key) { toast('Enter a Groq API key first', 'warning'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (res.ok) {
        setTestResult({ ok: true, message: 'Groq API key is valid ✓' });
        toast('Groq API connected!', 'success');
      } else {
        setTestResult({ ok: false, message: `Invalid key (${res.status})` });
        toast('Invalid API key', 'error');
      }
    } catch {
      setTestResult({ ok: false, message: 'Connection failed' });
      toast('Connection failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const toggleShow = (key) => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ padding: '40px', maxWidth: '600px' }}>
      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '6px' }}>
          CONFIGURATION
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Settings
        </h1>
        <p style={{ marginTop: '8px', color: 'var(--text2)', fontSize: '14px', lineHeight: 1.5 }}>
          API keys are stored only in your browser. Never sent to any server except the LLM provider you choose.
        </p>
      </div>

      {/* LLM Provider */}
      <Section title="LLM PROVIDER">
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Active Provider</label>
          <select
            value={settings.provider}
            onChange={e => setSettings(prev => ({ ...prev, provider: e.target.value }))}
            style={selectStyle}
          >
            <option value="groq">Groq — Llama 3.3 70B (Recommended, Free)</option>
            <option value="kimi">Kimi — moonshot-v1-8k (Free tier)</option>
            <option value="nvidia">Nvidia NIM — Llama 3 70B (Free credits)</option>
          </select>
        </div>
      </Section>

      {/* API Keys */}
      <Section title="API KEYS">
        <ApiKeyField
          label="Groq API Key"
          hint="Get free at console.groq.com — 14,400 requests/day"
          value={settings.apiKeys.groq}
          show={showKeys.groq}
          onChange={v => updateKey('groq', v)}
          onToggleShow={() => toggleShow('groq')}
          onTest={testGroq}
          testing={testing}
          testResult={testResult}
          provider="groq"
          active={settings.provider === 'groq'}
        />
        <ApiKeyField
          label="Kimi API Key"
          hint="Get at platform.moonshot.cn — limited free tier"
          value={settings.apiKeys.kimi}
          show={showKeys.kimi}
          onChange={v => updateKey('kimi', v)}
          onToggleShow={() => toggleShow('kimi')}
          provider="kimi"
          active={settings.provider === 'kimi'}
        />
        <ApiKeyField
          label="Nvidia NIM API Key"
          hint="Get at build.nvidia.com — free credits on signup"
          value={settings.apiKeys.nvidia}
          show={showKeys.nvidia}
          onChange={v => updateKey('nvidia', v)}
          onToggleShow={() => toggleShow('nvidia')}
          provider="nvidia"
          active={settings.provider === 'nvidia'}
        />
      </Section>

      {/* Behavior */}
      <Section title="BEHAVIOR">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>Auto-fallback on rate limit</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>Switches to next provider when current one is rate-limited</div>
          </div>
          <Toggle
            value={settings.autoFallback}
            onChange={v => setSettings(prev => ({ ...prev, autoFallback: v }))}
          />
        </div>
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>Request delay</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>Delay between API calls to avoid rate limits</div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)' }}>
              {settings.requestDelay}ms
            </span>
          </div>
          <input
            type="range" min={500} max={5000} step={500}
            value={settings.requestDelay}
            onChange={e => setSettings(prev => ({ ...prev, requestDelay: +e.target.value }))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>
      </Section>

      {/* Save */}
      <button onClick={handleSave} style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--accent)', color: '#000',
        border: 'none', borderRadius: '4px',
        padding: '12px 24px', cursor: 'pointer',
        fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500,
        letterSpacing: '0.05em',
        transition: 'opacity 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <Save size={14} />
        SAVE SETTINGS
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: '12px' }}>
        {title}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ padding: '16px', background: 'var(--bg2)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ApiKeyField({ label, hint, value, show, onChange, onToggleShow, onTest, testing, testResult, provider, active }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <label style={labelStyle}>{label}</label>
        {active && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent)', background: 'rgba(212,160,23,0.15)', padding: '1px 6px', borderRadius: '2px' }}>ACTIVE</span>}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={`Enter ${label}...`}
            style={{ ...inputStyle, paddingRight: '36px', width: '100%' }}
          />
          {onToggleShow && (
            <button onClick={onToggleShow} style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
              display: 'flex', alignItems: 'center',
            }}>
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
        </div>
        {onTest && provider === 'groq' && (
          <button onClick={onTest} disabled={testing} style={{
            padding: '8px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)',
            borderRadius: '4px', cursor: testing ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)',
            opacity: testing ? 0.5 : 1, whiteSpace: 'nowrap',
          }}>
            {testing ? '...' : 'TEST'}
          </button>
        )}
      </div>
      {testResult && provider === 'groq' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: testResult.ok ? 'var(--green)' : 'var(--red)' }}>
          {testResult.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {testResult.message}
        </div>
      )}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>{hint}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: '40px', height: '22px',
      background: value ? 'var(--accent)' : 'var(--bg4)',
      border: '1px solid var(--border2)',
      borderRadius: '11px', cursor: 'pointer', position: 'relative',
      transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: '2px',
        left: value ? '19px' : '2px',
        width: '16px', height: '16px',
        background: value ? '#000' : 'var(--text3)',
        borderRadius: '50%', transition: 'left 0.2s',
      }} />
    </button>
  );
}

const labelStyle = { fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' };
const inputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  padding: '8px 12px',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  outline: 'none',
};
const selectStyle = {
  ...inputStyle,
  width: '100%',
  cursor: 'pointer',
};
