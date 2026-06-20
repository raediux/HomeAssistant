import { useEffect, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconPlus, IconX, IconArrowsSplit2, IconLink } from '@tabler/icons-react';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { dbLoadMeals, dbSaveMeal, dbDeleteMeal } from '../../db.js';
import { cn, memberSlug } from '../../utils.js';
import Shopping from '../Shopping/Shopping.jsx';
import s from './MealPlanner.module.css';

const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MEMBER_COLORS = ['var(--accent)', 'var(--pink)', 'var(--yellow)', '#64c882'];
const COUPLE_SIZE = 2;

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function weekLabel(weekStart) {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const crossMonth = weekStart.getMonth() !== end.getMonth();
  const sStr = crossMonth ? `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]}` : `${weekStart.getDate()}`;
  return `Sun ${sStr} – Sat ${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`;
}

function isSplit(dayData, slot, members) {
  if (dayData['couple']?.[slot]) return false;
  if (members.slice(0, COUPLE_SIZE).some(m => dayData[memberSlug(m.name)]?.[slot])) return true;
  return slot === 'lunch'; // lunch defaults to split, dinner to linked
}

function linkify(text) {
  const urlRe = /https?:\/\/[^\s]+/g;
  const parts = [];
  let last = 0, m;
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>);
    const url = m[0];
    parts.push(<a key={m.index} href={url} target="_blank" rel="noopener noreferrer" className={s.mpLink} onClick={e => e.stopPropagation()}>{url}</a>);
    last = m.index + url.length;
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>);
  return parts;
}

export default function MealPlanner() {
  const { members } = useHousehold();
  const [meals, setMeals]       = useState({});
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const ws = new Date(today); ws.setDate(today.getDate() - today.getDay());
    return ws;
  });
  const [modal, setModal] = useState(null); // { dateKey, person, slot, existing }

  useEffect(() => {
    dbLoadMeals().then(rows => {
      const map = {};
      for (const r of rows) {
        if (!map[r.date]) map[r.date] = {};
        if (!map[r.date][r.person]) map[r.date][r.person] = {};
        map[r.date][r.person][r.slot] = r.meal;
      }
      setMeals(map);
    });
  }, []);

  function prevWeek() { setWeekStart(ws => { const d = new Date(ws); d.setDate(d.getDate()-7); return d; }); }
  function nextWeek() { setWeekStart(ws => { const d = new Date(ws); d.setDate(d.getDate()+7); return d; }); }

  function openModal(dk, person, slot) {
    const existing = meals[dk]?.[person]?.[slot] || '';
    setModal({ dateKey: dk, person, slot, existing });
  }

  async function confirmMeal(val) {
    if (!val.trim() || !modal) return;
    const { dateKey: dk, person, slot } = modal;
    setMeals(prev => {
      const next = { ...prev, [dk]: { ...(prev[dk] || {}), [person]: { ...(prev[dk]?.[person] || {}), [slot]: val.trim() } } };
      return next;
    });
    setModal(null);
    await dbSaveMeal(dk, person, slot, val.trim());
  }

  async function removeCell(dk, person, slot) {
    setMeals(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[dk]?.[person]) {
        delete next[dk][person][slot];
        if (!next[dk][person].lunch && !next[dk][person].dinner) delete next[dk][person];
        const allKeys = [...(members || []).map(m => memberSlug(m.name)), 'couple'];
        if (!allKeys.some(k => next[dk]?.[k])) delete next[dk];
      }
      return next;
    });
    await dbDeleteMeal(dk, person, slot);
  }

  async function splitCouple(dk, slot) {
    const meal = meals[dk]?.['couple']?.[slot];
    const coupleMembers = (members || []).slice(0, COUPLE_SIZE);
    setMeals(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[dk]) next[dk] = {};
      for (const m of coupleMembers) {
        const p = memberSlug(m.name);
        if (!next[dk][p]) next[dk][p] = {};
        if (meal) next[dk][p][slot] = meal;
      }
      if (next[dk]['couple']) {
        delete next[dk]['couple'][slot];
        if (!next[dk]['couple'].lunch && !next[dk]['couple'].dinner) delete next[dk]['couple'];
      }
      return next;
    });
    const saves = meal ? coupleMembers.map(m => dbSaveMeal(dk, memberSlug(m.name), slot, meal)) : [];
    await Promise.all([dbDeleteMeal(dk, 'couple', slot), ...saves]);
  }

  async function mergeCouple(dk, slot) {
    const coupleMembers = (members || []).slice(0, COUPLE_SIZE);
    let meal = null;
    const deletes = [];
    setMeals(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[dk]) next[dk] = {};
      if (!next[dk]['couple']) next[dk]['couple'] = {};
      for (const m of coupleMembers) {
        const p = memberSlug(m.name);
        if (!meal) meal = next[dk][p]?.[slot] || null;
        if (next[dk][p]?.[slot]) {
          delete next[dk][p][slot];
          if (!next[dk][p].lunch && !next[dk][p].dinner) delete next[dk][p];
          deletes.push(dbDeleteMeal(dk, p, slot));
        }
      }
      if (meal) next[dk]['couple'][slot] = meal;
      return next;
    });
    await Promise.all([...deletes, ...(meal ? [dbSaveMeal(dk, 'couple', slot, meal)] : [])]);
  }

  const todayKey = dateKey(new Date());

  if (!members?.length) return null;

  return (
    <div className={s.layout}>

      {/* ── Left: Meal Grid ── */}
      <div className={s.colPlanner}>
        <div className={s.secHdr}>
          <div className={s.weekNav}>
            <button className={s.ib} onClick={prevWeek}><IconChevronLeft size={16} /></button>
            <span className={s.weekLabel}>{weekLabel(weekStart)}</span>
            <button className={s.ib} onClick={nextWeek}><IconChevronRight size={16} /></button>
          </div>
        </div>

        <div className={s.grid}>
          <div className={s.gridHeader}>
            <div className={s.colHdr}>Lunch</div>
            <div className={s.colHdr}>Dinner</div>
          </div>

          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
            const dk = dateKey(d);
            const dayData = meals[dk] || {};
            const isToday = dk === todayKey;

            return (
              <div key={dk} className={s.row}>
                <div className={`${s.dayLabel} ${isToday ? s.today : ''}`}>
                  <div className={s.dayName}>{DAY_NAMES[i]}</div>
                  <div className={s.dayDate}>{d.getDate()}</div>
                </div>

                <div className={s.persons}>
                  {members.map((member, ri) => {
                    const p = memberSlug(member.name);
                    const isCouple = ri < COUPLE_SIZE;
                    const isLast = ri === members.length - 1;
                    const color = MEMBER_COLORS[ri] || MEMBER_COLORS[0];

                    return (
                      <MealPersonRow
                        key={p}
                        person={p}
                        name={member.name}
                        color={color}
                        isCouple={isCouple}
                        isFirst={ri === 0}
                        isLast={isLast}
                        dayData={dayData}
                        dateKey={dk}
                        members={members}
                        onOpen={openModal}
                        onRemove={removeCell}
                        onSplit={splitCouple}
                        onMerge={mergeCouple}
                        s={s}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Shopping ── */}
      <div className={s.colShopping}>
        <div className={s.shopSecHdr}>
          <span className={s.shopTitle}>Shopping</span>
        </div>
        <Shopping embedded />
      </div>

      {modal && (
        <MealModal
          existing={modal.existing}
          onConfirm={confirmMeal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function MealPersonRow({ person, name, color, isCouple, isFirst, isLast, dayData, dateKey: dk, members, onOpen, onRemove, onSplit, onMerge, s }) {
  const nameClasses = cn(s.gname, isFirst && isCouple && s.gnameCouple, isLast && s.gnameLast);

  // Non-couple member — always individual
  if (!isCouple) {
    return (
      <>
        <div className={nameClasses} style={{ '--mb': color }}>{name}</div>
        {['lunch','dinner'].map(slot => {
          const meal = dayData[person]?.[slot];
          return (
            <div key={slot} className={cn(s.gcell, isLast && s.gcellLast)}>
              {meal ? (
                <div className={s.cellFilled} onClick={() => onOpen(dk, person, slot)}>
                  <span className={s.cellName}>{linkify(meal)}</span>
                  <button className={s.cellRm} onClick={e => { e.stopPropagation(); onRemove(dk, person, slot); }} title="Remove"><IconX size={13} /></button>
                </div>
              ) : (
                <button className={s.cellAdd} onClick={() => onOpen(dk, person, slot)}><IconPlus size={11} /> Add</button>
              )}
            </div>
          );
        })}
      </>
    );
  }

  // Couple member — each slot is independently split or merged
  return (
    <>
      <div className={nameClasses} style={{ '--mb': color }}>{name}</div>
      {['lunch','dinner'].map(slot => {
        const slotSplit = isSplit(dayData, slot, members);

        if (slotSplit) {
          // Individual cells for this slot
          const meal = dayData[person]?.[slot];
          return (
            <div key={slot} className={cn(s.gcell, isLast && s.gcellLast)}>
              {meal ? (
                <div className={s.cellFilled} onClick={() => onOpen(dk, person, slot)}>
                  <span className={s.cellName}>{linkify(meal)}</span>
                  {isFirst && <button className={s.mergeBtn} onClick={e => { e.stopPropagation(); onMerge(dk, slot); }} title="Combine"><IconLink size={13} /></button>}
                  <button className={s.cellRm} onClick={e => { e.stopPropagation(); onRemove(dk, person, slot); }} title="Remove"><IconX size={13} /></button>
                </div>
              ) : (
                <button className={s.cellAdd} onClick={() => onOpen(dk, person, slot)}><IconPlus size={11} /> Add</button>
              )}
            </div>
          );
        }

        // Couple mode — only isFirst renders the spanning cell
        if (!isFirst) return null;
        const meal = dayData['couple']?.[slot];
        return (
          <div key={slot} className={cn(s.gcell, s.gcellCouple)} style={{ gridRow: 'span 2' }}>
            {meal ? (
              <div className={s.cellFilled} onClick={() => onOpen(dk, 'couple', slot)}>
                <span className={s.cellName}>{linkify(meal)}</span>
                <button className={s.splitBtn} onClick={e => { e.stopPropagation(); onSplit(dk, slot); }} title="Split"><IconArrowsSplit2 size={13} /></button>
                <button className={s.cellRm} onClick={e => { e.stopPropagation(); onRemove(dk, 'couple', slot); }} title="Remove"><IconX size={13} /></button>
              </div>
            ) : (
              <button className={s.cellAdd} onClick={() => onOpen(dk, 'couple', slot)}><IconPlus size={11} /> Add</button>
            )}
          </div>
        );
      })}
    </>
  );
}

function MealModal({ existing, onConfirm, onClose }) {
  const [value, setValue] = useState(existing || '');

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-hdr">
          <span>{existing ? 'Edit meal' : 'Add meal'}</span>
          <button className="modal-x" onClick={onClose}><IconX size={18} /></button>
        </div>
        <label className="modal-lbl">Meal</label>
        <input
          autoFocus
          className="modal-input"
          style={{ marginBottom: 4 }}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(value); }}
          placeholder="e.g. Spaghetti Bolognese"
        />
        <div className="modal-ftr">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm(value)}>Save</button>
        </div>
      </div>
    </div>
  );
}
