import { useState, useEffect } from 'react';
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
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(() => {
    const stored = localStorage.getItem('ha_lockout_until');
    if (!stored) return null;
    const ts = parseInt(stored, 10);
    return ts > Date.now() ? ts : null;
  });
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!lockoutUntil) return;
    const tick = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setCountdown(0);
        setAttempts(0);
        localStorage.removeItem('ha_lockout_until');
        clearInterval(tick);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [lockoutUntil]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setMessage('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (lockoutUntil) return;
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAttempts(0);
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
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        const until = Date.now() + 300_000;
        localStorage.setItem('ha_lockout_until', String(until));
        setLockoutUntil(until);
        setCountdown(300);
        setError('Too many failed attempts. Try again in 5 minutes.');
      } else {
        setError(e.message || 'Authentication failed.');
      }
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

        <button className={s.btn} type="submit" disabled={loading || !!lockoutUntil}>
          {lockoutUntil ? `Locked out (${countdown}s)` : loading ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign in' : 'Sign up')}
        </button>

        <div className={s.error}>{error}</div>
        <div className={s.message}>{message}</div>
      </form>
    </div>
  );
}
