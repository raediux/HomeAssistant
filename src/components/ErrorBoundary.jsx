import { Component } from 'react';

// App-wide safety net. Without this, any uncaught render error unmounts the
// entire tree, leaving only the dark background. Here we catch it and show a
// minimal recovery screen instead.
export default class ErrorBoundary extends Component {
  state = { error: null, stack: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info);
    // Keep the component stack on screen too. Without it the recovery screen
    // says nothing useful, and diagnosing a crash on someone else's device
    // turns into guesswork.
    this.setState({ stack: info?.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: 'var(--text)',
          fontFamily: 'inherit',
          padding: 24,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 360 }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </div>

          <details style={{ maxWidth: 640, width: '100%', textAlign: 'left' }}>
            <summary style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer', textAlign: 'center' }}>
              Show details
            </summary>
            <pre style={{
              marginTop: 10,
              padding: 12,
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 11,
              lineHeight: 1.5,
              color: '#e88',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 260,
              overflow: 'auto',
            }}>
              {String(this.state.error?.stack || this.state.error)}
              {this.state.stack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 4,
              background: 'var(--accent, #4a8fd4)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
