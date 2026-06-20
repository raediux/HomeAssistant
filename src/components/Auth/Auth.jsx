import { useState } from 'react';
import { IconHome } from '@tabler/icons-react';
import { supabase } from '../../supabase.js';
import s from './Auth.module.css';

export default function Auth() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setMessage('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: 'https://raediux.github.io/HomeAssistant' },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage('Check your email to confirm your account, then sign in.');
          setMode('signin');
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      setError(e.message || 'Authentication failed.');
      setLoading(false);
    }
    // AuthContext picks up the new session automatically via onAuthStateChange
  }

  return (
    <div className={s.overlay}>
      <form className={s.box} onSubmit={handleSubmit}>
        <div className={s.logo}><IconHome size={36} /></div>
        <div className={s.title}>Home Assistant</div>

        <div className={s.tabs}>
          <button type="button" className={`${s.tab} ${mode === 'signin' ? s.active : ''}`} onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>Sign in</button>
          <button type="button" className={`${s.tab} ${mode === 'signup' ? s.active : ''}`} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Sign up</button>
        </div>

        <input className={s.input} type="email" placeholder="Email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className={s.input} type="password" placeholder="Password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} />

        <button className={s.btn} type="submit" disabled={loading}>
          {loading ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign in' : 'Sign up')}
        </button>

        <div className={s.error}>{error}</div>
        <div className={s.message}>{message}</div>
      </form>
    </div>
  );
}
