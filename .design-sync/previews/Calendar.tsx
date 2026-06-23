import { Calendar, MockProviders } from 'home-assistant-react';
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ color: '#ff6b6b', background: '#1c1c22', padding: 16, fontSize: 12, borderRadius: 8, margin: 16, wordBreak: 'break-all' }}>
        ERROR: {String(this.state.error?.message || this.state.error)}
      </div>
    );
    return this.props.children;
  }
}

export function Default() {
  return (
    <ErrorBoundary>
      <MockProviders>
        <div style={{ background: '#111110', minHeight: 600 }}>
          <Calendar />
        </div>
      </MockProviders>
    </ErrorBoundary>
  );
}
