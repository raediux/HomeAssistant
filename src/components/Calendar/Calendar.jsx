import { useEffect, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { useUndo } from '../../contexts/UndoContext.jsx';
import { dbLoadBadges, dbSaveBadge, dbDeleteBadge, dbLoadTasks } from '../../db.js';
import { useRealtimeSync } from '../../hooks/useRealtimeSync.js';
import { cn, memberSlug } from '../../utils.js';
import { isTaskDone } from '../Tasks/taskUtils.js';
import s from './Calendar.module.css';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_HDRS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const FULL_DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const BADGE_SWATCHES = [
  { color: '#4a8fd4', label: 'Blue'   },
  { color: '#c46090', label: 'Pink'   },
  { color: '#c9a838', label: 'Yellow' },
  { color: '#5a9e5a', label: 'Green'  },
];
const MEMBER_COLORS = ['#4a8fd4', '#c46090', '#c9a838', '#64c882'];

function toDateStr(d) { return d.toISOString().split('T')[0]; }
function monDow(jsDay) { return (jsDay + 6) % 7; }

export default function Calendar() {
  const { members } = useHousehold();
  const { scheduleDelete } = useUndo();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(toDateStr(now));
  const [badges, setBadges] = useState([]);
  const [tasks,  setTasks]  = useState([]);

  useEffect(() => {
    dbLoadBadges().then(setBadges);
    dbLoadTasks().then(setTasks);
  }, []);

  useRealtimeSync('calendar_badges', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setBadges(prev => prev.filter(b => b.id !== old.id));
    } else {
      const badge = { id: row.id, date: row.date, label: row.label, color: row.color };
      setBadges(prev => prev.some(b => b.id === badge.id) ? prev.map(b => b.id === badge.id ? badge : b) : [...prev, badge]);
    }
  });

  useRealtimeSync('tasks', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setTasks(prev => prev.filter(t => t.id !== old.id));
    } else {
      const task = { id: row.id, person: row.person, frequency: row.frequency, title: row.title, dueDate: row.due_date, dow: row.dow, done: row.done, lastDoneDate: row.last_done_date || null };
      setTasks(prev => prev.some(t => t.id === task.id) ? prev.map(t => t.id === task.id ? task : t) : [...prev, task]);
    }
  });

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

  // Member color lookup
  function memberColor(person) {
    const idx = (members || []).findIndex(m => memberSlug(m.name) === person);
    return MEMBER_COLORS[idx >= 0 ? idx % MEMBER_COLORS.length : 0];
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
              const combined  = [
                ...dayTasks.map(t  => ({ label: t.title, color: memberColor(t.person) })),
                ...dayBadges.map(b => ({ label: b.label, color: b.color })),
              ];
              const shown    = combined.slice(0, 3);
              const overflow = combined.length - 3;
              const classes  = cn(s.day, ds === todayStr && s.dayToday, ds === selected && s.daySelected);

              return (
                <div key={ds} className={classes} onClick={() => setSelected(ds)}>
                  <div className={s.dayNum}>{day}</div>
                  {shown.map((item, j) => (
                    <div key={j} className={s.calBadge} style={{ background: item.color + '22', color: item.color }}>
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

function DetailPanel({ dateStr, tasks, badges, memberColor, memberLabel, onAddBadge, onDeleteBadge, s }) {
  const [label, setLabel] = useState('');
  const [swatchIdx, setSwatchIdx] = useState(0);
  const inputRef = useRef(null);

  // Reset form when date changes
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
