import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { IconChevronLeft, IconChevronRight, IconPlus, IconX, IconArrowsSplit2, IconLink } from '@tabler/icons-react';

const MODAL_SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.9 };
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { dbLoadMeals, dbSaveMeal, dbDeleteMeal } from '../../db.js';
import { useRealtimeSync } from '../../hooks/useRealtimeSync.js';
import { cn, memberSlug } from '../../utils.js';
import { useShoppingData } from '../../hooks/useShoppingData.js';
import Shopping from '../Shopping/Shopping.jsx';
import ShoppingWorkingPanel from '../Shopping/ShoppingWorkingPanel.jsx';
import ShoppingPastPanel from '../Shopping/ShoppingPastPanel.jsx';
import ShoppingModal from '../Shopping/ShoppingModal.jsx';
import MealPlannerParticles from './MealPlannerParticles.jsx';
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
  const [activeMobilePanel, setActiveMobilePanel] = useState(2);
  const mobilePanelsRef = useRef(null);
  const shopData = useShoppingData();

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = mobilePanelsRef.current;
      if (el && el.clientWidth > 0) {
        el.scrollLeft = el.clientWidth * 2;
      }
    });
  }, []);

  function handleMobileScroll() {
    const el = mobilePanelsRef.current;
    if (!el) return;
    setActiveMobilePanel(Math.round(el.scrollLeft / el.clientWidth));
  }

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

  useRealtimeSync('meal_plans', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      const r = old;
      setMeals(prev => {
        if (!prev[r.date]?.[r.person]) return prev;
        const next = { ...prev, [r.date]: { ...prev[r.date], [r.person]: { ...prev[r.date][r.person] } } };
        delete next[r.date][r.person][r.slot];
        return next;
      });
    } else {
      setMeals(prev => ({
        ...prev,
        [row.date]: {
          ...prev[row.date],
          [row.person]: { ...prev[row.date]?.[row.person], [row.slot]: row.meal },
        },
      }));
    }
  });

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
    <>
    <div className={s.layout}>

      {/* ── Left: Meal Grid ── */}
      <div className={s.colPlanner} style={{ position: 'relative' }}>
        <MealPlannerParticles />
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

    </div>

      {/* ── Mobile 4-panel view ── */}
      <div className={s.mobileLayout}>
        <div className={s.mTabs}>
          {['Lunch','Dinner','This Week','All Items'].map((label, i) => (
            <button
              key={label}
              className={`${s.mTab} ${activeMobilePanel === i ? s.mTabActive : ''}`}
              onClick={() => {
                mobilePanelsRef.current?.scrollTo({ left: mobilePanelsRef.current.clientWidth * i, behavior: 'smooth' });
                setActiveMobilePanel(i);
              }}
            >{label}</button>
          ))}
        </div>
        <div className={s.mPanels} ref={mobilePanelsRef} onScroll={handleMobileScroll}>
          <div className={s.mPanel}>
            <MobileMealPanel slot="lunch" meals={meals} members={members} weekStart={weekStart}
              todayKey={todayKey} onOpen={openModal} onRemove={removeCell}
              onPrev={prevWeek} onNext={nextWeek} weekLabelStr={weekLabel(weekStart)} />
          </div>
          <div className={s.mPanel}>
            <MobileMealPanel slot="dinner" meals={meals} members={members} weekStart={weekStart}
              todayKey={todayKey} onOpen={openModal} onRemove={removeCell}
              onPrev={prevWeek} onNext={nextWeek} weekLabelStr={weekLabel(weekStart)} />
          </div>
          <div className={s.mPanel}>
            <ShoppingWorkingPanel shopData={shopData} showAddBtn noWrapper />
          </div>
          <div className={s.mPanel}>
            <ShoppingPastPanel shopData={shopData} noWrapper />
          </div>
        </div>
        {shopData.modal && (
          <ShoppingModal
            editItem={shopData.modal.editItem}
            defaultStore={shopData.modal.defaultStore}
            pastItems={shopData.past}
            onConfirm={shopData.handleModalConfirm}
            onClose={() => shopData.setModal(null)}
          />
        )}
      </div>

      {modal && (
        <MealModal
          existing={modal.existing}
          onConfirm={confirmMeal}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function MobileMealPanel({ slot, meals, members, weekStart, todayKey, onOpen, onRemove, onPrev, onNext, weekLabelStr }) {
  const coupleMembers = (members || []).slice(0, COUPLE_SIZE);
  const otherMembers  = (members || []).slice(COUPLE_SIZE);
  return (
    <>
      <div className={s.mPanelHdr}>
        <span className={s.mPanelTitle}>{slot.charAt(0).toUpperCase() + slot.slice(1)}</span>
        <div className={s.mWeekNav}>
          <button className={s.ib} onClick={onPrev}><IconChevronLeft size={14} /></button>
          <span className={s.mWeekLabel}>{weekLabelStr}</span>
          <button className={s.ib} onClick={onNext}><IconChevronRight size={14} /></button>
        </div>
      </div>
      <div className={s.mMealList}>
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
          const dk = dateKey(d);
          const dayData = meals[dk] || {};
          const isToday = dk === todayKey;
          const slotSplit = isSplit(dayData, slot, members || []);

          return (
            <div key={dk} className={cn(s.mDay, isToday && s.mDayToday)}>
              <div className={s.mDayMeta}>
                <span className={s.mDayName}>{DAY_NAMES[d.getDay()]}</span>
                <span className={s.mDayDate}>{d.getDate()}</span>
              </div>
              <div className={s.mDaySlots}>
                {slotSplit ? (
                  coupleMembers.map((m, ci) => {
                    const p = memberSlug(m.name);
                    const meal = dayData[p]?.[slot];
                    return (
                      <div key={p} className={s.mSlot}>
                        <span className={s.mName} style={{ color: MEMBER_COLORS[ci] }}>{m.name}</span>
                        {meal ? (
                          <div className={s.mMeal} onClick={() => onOpen(dk, p, slot)}>
                            <span className={s.mMealText}>{meal}</span>
                            <button className={s.mRm} onClick={e => { e.stopPropagation(); onRemove(dk, p, slot); }}>×</button>
                          </div>
                        ) : (
                          <button className={s.mAdd} onClick={() => onOpen(dk, p, slot)}>+ Add</button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className={s.mSlot}>
                    <span className={s.mName}>
                      <span style={{ color: MEMBER_COLORS[0] }}>{coupleMembers[0]?.name}</span>
                      {' & '}
                      <span style={{ color: MEMBER_COLORS[1] }}>{coupleMembers[1]?.name}</span>
                    </span>
                    {(() => {
                      const meal = dayData['couple']?.[slot];
                      return meal ? (
                        <div className={s.mMeal} onClick={() => onOpen(dk, 'couple', slot)}>
                          <span className={s.mMealText}>{meal}</span>
                          <button className={s.mRm} onClick={e => { e.stopPropagation(); onRemove(dk, 'couple', slot); }}>×</button>
                        </div>
                      ) : (
                        <button className={s.mAdd} onClick={() => onOpen(dk, 'couple', slot)}>+ Add</button>
                      );
                    })()}
                  </div>
                )}
                {otherMembers.map((m, oi) => {
                  const p = memberSlug(m.name);
                  const meal = dayData[p]?.[slot];
                  return (
                    <div key={p} className={s.mSlot}>
                      <span className={s.mName} style={{ color: MEMBER_COLORS[COUPLE_SIZE + oi] }}>{m.name}</span>
                      {meal ? (
                        <div className={s.mMeal} onClick={() => onOpen(dk, p, slot)}>
                          <span className={s.mMealText}>{meal}</span>
                          <button className={s.mRm} onClick={e => { e.stopPropagation(); onRemove(dk, p, slot); }}>×</button>
                        </div>
                      ) : (
                        <button className={s.mAdd} onClick={() => onOpen(dk, p, slot)}>+ Add</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
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
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="modal-box" initial={{ scale: 0.88, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.88, y: 16, opacity: 0 }} transition={MODAL_SPRING}>
        <div className="modal-hdr">
          <span>{existing ? 'Edit meal' : 'Add meal'}</span>
          <button className="modal-x" onClick={onClose}><IconX size={18} /></button>
        </div>
        <label className="modal-lbl">Meal</label>
        <input
          autoFocus
          className="modal-input"
          style={{ marginBottom: 4 }}
          maxLength={200}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(value); }}
          placeholder="e.g. Spaghetti Bolognese"
        />
        <div className="modal-ftr">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm(value)}>Save</button>
        </div>
      </motion.div>
    </div>
  );
}
