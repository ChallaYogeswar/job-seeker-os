import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '48px 40px',
          fontFamily: 'var(--font-mono)',
          maxWidth: '540px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--red)', letterSpacing: '0.1em', marginBottom: '10px' }}>
            RUNTIME ERROR
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
            Something went wrong
          </div>
          <div style={{
            background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '6px', padding: '14px 16px',
            fontSize: '12px', color: 'var(--red)', lineHeight: 1.7,
            marginBottom: '20px', wordBreak: 'break-word',
          }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: 'var(--accent)', color: '#000',
              border: 'none', borderRadius: '4px',
              padding: '10px 20px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500,
              letterSpacing: '0.06em',
            }}
          >
            TRY AGAIN
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
