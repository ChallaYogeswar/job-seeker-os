import { Link2, FileText, Wand2, BarChart2, KanbanSquare, Settings } from 'lucide-react';

const navItems = [
  { id: 'collector', label: 'Collector', icon: Link2, phase: '1', active: true },
  { id: 'tailor', label: 'Tailor', icon: Wand2, phase: '2', active: true },
  { id: 'analyser', label: 'Analyser', icon: BarChart2, phase: '3', active: true },
  { id: 'tracker', label: 'Tracker', icon: KanbanSquare, phase: '4', active: false },
  { id: 'settings', label: 'Settings', icon: Settings, phase: null, active: true },
];

export default function Sidebar({ currentPage, onNavigate, jobCount = 0 }) {
  return (
    <aside style={{
      width: '220px',
      flexShrink: 0,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{
            width: '8px', height: '8px',
            background: 'var(--accent)',
            borderRadius: '50%',
            boxShadow: '0 0 8px var(--accent)',
          }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '15px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}>JOB SEEKER OS</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text3)',
          paddingLeft: '16px',
        }}>v3.0 · PHASE 3</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 0', flex: 1 }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const isDisabled = !item.active;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onNavigate(item.id)}
              disabled={isDisabled}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                background: isActive ? 'var(--bg3)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                border: 'none',
                borderRight: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.35 : 1,
                color: isActive ? 'var(--text)' : 'var(--text2)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                letterSpacing: '0.05em',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isDisabled && !isActive) e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.color = isDisabled ? 'var(--text3)' : 'var(--text2)';
              }}
            >
              <Icon size={15} strokeWidth={1.5} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.phase && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: isActive ? 'var(--accent)' : 'var(--text3)',
                  background: 'var(--bg)',
                  padding: '1px 5px',
                  borderRadius: '2px',
                  border: '1px solid var(--border)',
                }}>P{item.phase}</span>
              )}
              {isDisabled && (
                <span style={{ fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>SOON</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer stats */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text3)',
          marginBottom: '6px',
        }}>STORED</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '24px',
            fontWeight: 500,
            color: 'var(--accent)',
          }}>{jobCount}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)' }}>jobs</span>
        </div>
      </div>
    </aside>
  );
}
