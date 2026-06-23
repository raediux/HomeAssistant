import { useState } from 'react';
import { ColorPicker } from 'home-assistant-react';

const toolbar = {
  padding: '8px 12px',
  background: '#1c1c22',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  borderRadius: 8,
};

export function InToolbar() {
  const [color, setColor] = useState('#4a8fd4');
  return (
    <div style={{ background: '#111110', padding: 20 }}>
      <div style={toolbar}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <ColorPicker color={color} onChange={setColor} />
        <span style={{ color: '#9e9b93', fontSize: 11, fontFamily: 'inherit' }}>{color}</span>
      </div>
    </div>
  );
}

export function AccentColors() {
  return (
    <div style={{ background: '#111110', padding: 20, display: 'flex', gap: 12 }}>
      {['#4a8fd4', '#c46090', '#c9a838', '#64c882', '#e05555'].map(c => (
        <div key={c} style={toolbar}>
          <ColorPicker color={c} onChange={() => {}} />
          <span style={{ color: '#9e9b93', fontSize: 10, fontFamily: 'monospace' }}>{c}</span>
        </div>
      ))}
    </div>
  );
}
