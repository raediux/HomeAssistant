import { Auth } from 'home-assistant-react';

export function SignIn() {
  return (
    <div style={{ minHeight: 400, background: '#111110', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Auth />
    </div>
  );
}
