import { useEffect, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconCalendarEvent } from '@tabler/icons-react';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { useSession } from '../../contexts/AuthContext.jsx';
import { useUndo } from '../../contexts/UndoContext.jsx';
import { dbSaveBadge, dbDeleteBadge } from '../../db.js';
import { useCalendarData } from '../../contexts/CalendarContext.jsx';
import { useTasksData } from '../../contexts/TasksContext.jsx';
import { cn, memberSlug } from '../../utils.js';
import { isTaskDone } from '../Tasks/taskUtils.js';
import s from './Calendar.module.css';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_HDRS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MAX_BADGES_PER_DAY = 3;
const FULL_DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const BADGE_SWATCHES = [
  { color: '#4a8fd4', label: 'Blue'   },
  { color: '#c46090', label: 'Pink'   },
  { color: '#c9a838', label: 'Yellow' },
  { color: '#5a9e5a', label: 'Green'  },
];

function toDateStr(d) { return d.toISOString().split('T')[0]; }
function monDow(jsDay) { return (jsDay + 6) % 7; }

function initiateGoogleOAuth(userId) {
  const csrf = crypto.randomUUID();
  document.cookie = `g_csrf=${csrf}; Path=/; Max-Age=600; SameSite=Lax`;
  const state = btoa(JSON.stringify({ userId, csrf }));
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: 'https://homeapp.raediux.com/auth/google/callback',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export default function Calendar() {
  const { members } = useHousehold();
  const session = useSession();
  const { scheduleDelete } = useUndo();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(toDateStr(now));
  const { badges, setBadges, googleEvents, hasGoogleToken, fetchGoogleEventsForMonth } = useCalendarData();
  const { tasks } = useTasksData();

  useEffect(() => {
    fetchGoogleEventsForMonth(year, month);
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelected(null);
  }

  // Build task map: dateStr → tasks (occasional, not done, this month)
  const taskMap = {};
  for (const t of tasks) {
    if (t.frequency !== 'occasional' || !t.dueDate || isTaskDone(t)) continue;
    const d = new Date(t.dueDate + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month)
      (taskMap[t.dueDate] = taskMap[t.dueDate] || []).push(t);
  }

  // Build badge map: dateStr → badges (this month)
  const badgeMap = {};
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  for (const b of badges) {
    if (b.date.startsWith(prefix))
      (badgeMap[b.date] = badgeMap[b.date] || []).push(b);
  }

  // Build Google event map: dateStr → events (this month)
  const googleMap = {};
  for (const e of googleEvents) {
    const ds = (e.start || '').split('T')[0];
    if (ds.startsWith(prefix))
      (googleMap[ds] = googleMap[ds] || []).push(e);
  }

  function memberColor(person) {
    const m = (members || []).find(m => (m.slug ?? memberSlug(m.name)) === person);
    return m?.color ?? '#64c882';
  }
  function memberLabel(person) {
    const m = (members || []).find(m => memberSlug(m.name) === person);
    return m?.name || person;
  }

  async function addBadge(dateStr, label, color) {
    if (!label.trim()) return;
    const newId = await dbSaveBadge({ date: dateStr, label: label.trim(), color });
    if (newId) setBadges(prev => [...prev, { id: newId, date: dateStr, label: label.trim(), color }]);
  }

  function deleteBadge(id, label) {
    setBadges(prev => prev.filter(b => b.id !== id));
    scheduleDelete(`"${label}" deleted`, () => dbDeleteBadge(id));
  }

  const todayStr = toDateStr(new Date());
  const firstDay = new Date(year, month, 1);
  const startDow = monDow(firstDay.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className={s.container}>
      <div className={s.nav}>
        <button className={s.ib} onClick={prevMonth}><IconChevronLeft size={16} /></button>
        <span className={s.monthLabel}>{MONTH_NAMES[month]} {year}</span>
        <button className={s.ib} onClick={nextMonth}><IconChevronRight size={16} /></button>
        {!hasGoogleToken && session?.user && (
          <button className={s.connectBtn} onClick={() => initiateGoogleOAuth(session.user.id)}>
            <IconCalendarEvent size={13} /> Connect Google Calendar
          </button>
        )}
      </div>

      <div className={s.body}>
        <div className={s.gridWrap}>
          <div className={s.grid}>
            {DAY_HDRS.map(d => <div key={d} className={s.dayHdr}>{d}</div>)}
            {Array.from({ length: startDow }, (_, i) => (
              <div key={`empty-${i}`} className={`${s.day} ${s.dayEmpty}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const ds  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayTasks  = taskMap[ds]  || [];
              const dayBadges = badgeMap[ds] || [];
              const dayGoogle = googleMap[ds] || [];
              const combined  = [
                ...dayTasks.map(t  => ({ label: t.title, color: memberColor(t.person) })),
                ...dayBadges.map(b => ({ label: b.label, color: b.color })),
                ...dayGoogle.map(e => ({ label: e.title, color: '#4a8fd4', google: true })),
              ];
              const shown    = combined.slice(0, MAX_BADGES_PER_DAY);
              const overflow = combined.length - MAX_BADGES_PER_DAY;
              const classes  = cn(s.day, ds === todayStr && s.dayToday, ds === selected && s.daySelected);

              return (
                <div key={ds} className={classes} onClick={() => setSelected(ds)}>
                  <div className={s.dayNum}>{day}</div>
                  {shown.map((item, j) => (
                    <div key={j} className={item.google ? s.googleBadge : s.calBadge} style={{ background: item.color + '22', color: item.color }}>
                      {item.label}
                    </div>
                  ))}
                  {overflow > 0 && <div className={s.calBadgeMore}>+{overflow} more</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className={s.detail}>
          {!selected ? (
            <div className={s.detailEmpty}>Select a day</div>
          ) : (
            <DetailPanel
              dateStr={selected}
              tasks={taskMap[selected] || []}
              badges={badgeMap[selected] || []}
              googleEvents={googleMap[selected] || []}
              memberColor={memberColor}
              memberLabel={memberLabel}
              onAddBadge={addBadge}
              onDeleteBadge={deleteBadge}
              s={s}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ dateStr, tasks, badges, googleEvents, memberColor, memberLabel, onAddBadge, onDeleteBadge, s }) {
  const [label, setLabel] = useState('');
  const [swatchIdx, setSwatchIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { setLabel(''); setSwatchIdx(0); }, [dateStr]);

  const d = new Date(dateStr + 'T00:00:00');
  const heading = `${FULL_DAYS[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;

  async function handleAdd() {
    if (!label.trim()) { inputRef.current?.focus(); return; }
    await onAddBadge(dateStr, label, BADGE_SWATCHES[swatchIdx].color);
    setLabel('');
  }

  return (
    <>
      <div className={s.detailDate}>{heading}</div>

      {tasks.length > 0 && (
        <>
          <div className={s.detailSection}>Tasks</div>
          {tasks.map(t => (
            <div key={t.id} className={s.taskRow}>
              <div className={s.taskDot} style={{ background: memberColor(t.person) }} />
              <div>
                <div className={s.taskTitle}>{t.title}</div>
                <div className={s.taskPerson}>{memberLabel(t.person)}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {badges.length > 0 && (
        <>
          <div className={s.detailSection}>Badges</div>
          {badges.map(b => (
            <div key={b.id} className={s.badgeRow}>
              <div className={s.badgePill} style={{ background: b.color + '22', color: b.color }}>{b.label}</div>
              <button className={s.badgeDel} onClick={() => onDeleteBadge(b.id, b.label)} title="Remove">×</button>
            </div>
          ))}
        </>
      )}

      {googleEvents.length > 0 && (
        <>
          <div className={s.detailSection}>Google Calendar</div>
          {googleEvents.map(e => {
            const timeStr = e.start.includes('T')
              ? new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : null;
            return (
              <div key={e.id} className={s.googleRow}>
                <IconCalendarEvent size={11} style={{ color: '#4a8fd4', flexShrink: 0 }} />
                <div>
                  <div className={s.googleTitle}>{e.title}</div>
                  {timeStr && <div className={s.googleTime}>{timeStr}</div>}
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className={s.detailSection}>Add badge</div>
      <div className={s.badgeForm}>
        <input
          ref={inputRef}
          className={s.badgeInput}
          placeholder="Label… then ↵"
          maxLength={30}
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        />
        <div className={s.swatches}>
          {BADGE_SWATCHES.map((sw, i) => (
            <button
              key={i}
              type="button"
              className={`${s.swatch} ${i === swatchIdx ? s.selected : ''}`}
              style={{ background: sw.color }}
              title={sw.label}
              onClick={() => setSwatchIdx(i)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
