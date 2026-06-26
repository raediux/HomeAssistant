import { Component } from 'react';

// App-wide safety net. Without this, any uncaught render error unmounts the
// entire tree, leaving only the dark background. Here we catch it and show a
// minimal recovery screen instead.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info);
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
