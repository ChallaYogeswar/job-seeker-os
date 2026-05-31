import { useState, useEffect, useCallback } from 'react';

let toastId = 0;
let externalSetToasts = null;

export function toast(message, type = 'info', duration = 4000) {
  if (externalSetToasts) {
    const id = ++toastId;
    externalSetToasts(prev => [...prev, { id, message, type, duration }]);
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    externalSetToasts = setToasts;
    return () => { externalSetToasts = null; };
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={remove} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, onRemove]);

  const colors = {
    info: { border: '#3b82f6', icon: '◆' },
    success: { border: '#22c55e', icon: '✓' },
    error: { border: '#ef4444', icon: '✗' },
    warning: { border: '#f59e0b', icon: '!' },
  };
  const c = colors[t.type] || colors.info;

  return (
    <div className="fade-in" style={{
      pointerEvents: 'all',
      background: '#111111',
      border: `1px solid ${c.border}`,
      borderLeft: `3px solid ${c.border}`,
      padding: '10px 16px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      maxWidth: '360px',
      cursor: 'pointer',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text)',
    }} onClick={() => onRemove(t.id)}>
      <span style={{ color: c.border, fontWeight: 700 }}>{c.icon}</span>
      {t.message}
    </div>
  );
}
