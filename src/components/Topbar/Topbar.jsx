import { useCallback, useEffect, useRef, useState } from 'react';
import { IconUser, IconLogout, IconMail, IconSettings } from '@tabler/icons-react';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase.js';
import { clearHouseholdId } from '../../db.js';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { useSession } from '../../contexts/AuthContext.jsx';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import Weather from './Weather.jsx';
import SettingsModal from '../Settings/SettingsModal.jsx';
import s from './Topbar.module.css';

function useClock() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function formatTime(now) {
  const hm = now.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  const parts = hm.slice(0, -2).trim().split(':');
  return { h: parts[0], m: parts[1], ampm: hm.slice(-2).toUpperCase() };
}

export default function Topbar() {
  const { h, m, ampm } = useClock();
  const session = useSession();
  const household = useHousehold();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const menuRef = useRef(null);

  const now = new Date();
  const day  = now.toLocaleDateString('en-AU', { weekday: 'long' });
  const date = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!session) return;
    supabase.from('household_members')
      .select('name').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.name || session.user.email || '—'));
  }, [session]);

  const closeMenu = useCallback(() => setOpen(false), []);
  useClickOutside(menuRef, closeMenu);

  return (
    <div className={s.topbar}>
      <div className={s.profileMenu} ref={menuRef}>
        <button className={s.profileBtn} onClick={() => setOpen(o => !o)}>
          <IconUser size={22} />
        </button>
        {open && (
          <div className={s.dropdown}>
            <div className={s.displayName}>{displayName}</div>
            <div className={s.tier} data-tier={household?.tier || 'free'}>
              {(household?.tier || 'free').charAt(0).toUpperCase() + (household?.tier || 'free').slice(1)}
            </div>
            <button className={s.signoutBtn} onClick={() => { setOpen(false); setSettingsOpen(true); }}>
              <IconSettings size={15} /> Settings
            </button>
            <button className={s.signoutBtn} onClick={() => { clearHouseholdId(); supabase.auth.signOut(); }}>
              <IconLogout size={15} /> Sign out
            </button>
          </div>
        )}
      </div>

      <div className={s.left}>
        <div className={s.dateGroup}>
          <div className={s.day}>{day}</div>
          <div className={s.date}>{date}</div>
        </div>
        <div className={s.time}>
          {h}<span className={s.colon}>:</span>{m}<span className={s.ampm}>{ampm}</span>
        </div>
      </div>

      <Weather />
      <AnimatePresence>
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
      <a
        href="https://mail.google.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px', transition: 'color .15s, background .15s', textDecoration: 'none', marginLeft: 'auto' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface2)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'transparent'; }}
      >
        <IconMail size={20} />
      </a>
    </div>
  );
}
