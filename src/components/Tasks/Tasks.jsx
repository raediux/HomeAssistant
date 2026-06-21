import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useTilt } from '../../hooks/useTilt.js';
import { IconPlus, IconEdit, IconTrash, IconCheck, IconAlertCircle, IconClock, IconCalendar } from '@tabler/icons-react';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { dbLoadTasks, dbSaveTask, dbDeleteTask } from '../../db.js';
import { memberSlug } from '../../utils.js';
import { isTaskDone, getDueBadge, sortTasks, toDateStr } from './taskUtils.js';
import TaskModal from './TaskModal.jsx';
import s from './Tasks.module.css';

const FREQUENCIES = ['daily', 'weekly', 'occasional'];
const FREQ_LABEL  = { daily: 'Daily', weekly: 'Weekly', occasional: 'Occasional' };
const BADGE_ICON  = { 'ti-alert-circle': IconAlertCircle, 'ti-clock': IconClock, 'ti-calendar': IconCalendar };
const BADGE_CLS   = { 'b-red': s.bRed, 'b-amb': s.bAmb, 'b-blue': s.bBlue };
const ACCENTS = [
  { col: '#4a8fd4', glow: 'rgba(74,143,212,0.22)',  tint: 'rgba(74,143,212,0.05)',  shadow: 'rgba(74,143,212,0.18)' },
  { col: '#c46090', glow: 'rgba(196,96,144,0.15)',   tint: 'rgba(196,96,144,0.04)',  shadow: 'rgba(196,96,144,0.14)' },
  { col: '#c9a838', glow: 'rgba(201,168,56,0.11)',   tint: 'rgba(201,168,56,0.04)',  shadow: 'rgba(201,168,56,0.12)' },
  { col: '#64c882', glow: 'rgba(100,200,130,0.13)',  tint: 'rgba(100,200,130,0.04)', shadow: 'rgba(100,200,130,0.12)' },
];

export default function Tasks() {
  const { members } = useHousehold();
  const [tasks, setTasks] = useState([]);
  const [modal, setModal] = useState(null);
  const [activeDot, setActiveDot] = useState(0);
  const nextId = useRef(200);
  const layoutRef = useRef(null);

  useEffect(() => {
    dbLoadTasks().then(data => {
      setTasks(data);
      if (data.length) nextId.current = Math.max(...data.map(t => t.id)) + 1;
    });
  }, []);

  function handleScroll() {
    const el = layoutRef.current;
    if (!el) return;
    setActiveDot(Math.round(el.scrollLeft / el.clientWidth));
  }

  function toggleDone(task) {
    let updated;
    if (task.frequency === 'occasional') {
      updated = { ...task, done: !task.done };
    } else {
      const done = isTaskDone(task);
      updated = { ...task, lastDoneDate: done ? null : toDateStr(new Date()) };
    }
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    dbSaveTask(updated);
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    dbDeleteTask(id);
  }

  function openAdd(person, frequency) {
    setModal({ mode: 'add', person, frequency, task: null });
  }

  function openEdit(task) {
    setModal({ mode: 'edit', person: task.person, frequency: task.frequency, task });
  }

  function handleModalConfirm({ title, dueDate, dow }) {
    if (modal.mode === 'add') {
      const task = {
        id: nextId.current++,
        person: modal.person,
        frequency: modal.frequency,
        title, dueDate, dow,
        done: false, lastDoneDate: null,
      };
      setTasks(prev => [...prev, task]);
      dbSaveTask(task);
    } else {
      const updated = { ...modal.task, title, dueDate, dow };
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      dbSaveTask(updated);
    }
    setModal(null);
  }


  if (!members?.length) return null;

  return (
    <>
      <div className={s.dotBar}>
        {members.map((m, i) => (
          <div
            key={m.name}
            className={`${s.dot} ${i === activeDot ? s.dotActive : ''}`}
            style={{ '--dot-col': ACCENTS[i % 4].col }}
          />
        ))}
      </div>

      <div className={s.layout}>
      <div className={s.mobileScroll} ref={layoutRef} onScroll={handleScroll}>
        {members.map((member, idx) => {
          const slug = memberSlug(member.name);
          const ci   = idx % 4;
          const acc  = ACCENTS[ci];
          return (
            <div
              key={slug}
              className={s.glowWrap}
              style={{ '--col': acc.col, '--col-glow': acc.glow, '--col-tint': acc.tint, '--col-shadow': acc.shadow }}
              data-person={slug}
            >
              <div className={s.column}>
                <div className={s.colName}>{member.name}</div>
                <div className={s.colTasks}>
                  {FREQUENCIES.map(freq => {
                    const key = `${slug}-${freq}`;
                    const visible = sortTasks(
                      tasks.filter(t => t.person === slug && t.frequency === freq),
                      freq
                    );

                    return (
                      <div key={freq} className={s.section}>
                        <div className={s.rowLabel}>{FREQ_LABEL[freq]}</div>
                        <div className={s.box}>
                          <div className={s.boxHdr}>
                            <div className={s.hdrBtns}>
                              <button className={s.ib} onClick={() => openAdd(slug, freq)} title="Add task">
                                <IconPlus size={14} />
                              </button>
                            </div>
                          </div>

                          {visible.length === 0 ? (
                            <p className={s.empty}>No tasks</p>
                          ) : (
                            <div className={s.items}>
                              {visible.map(task => {
                                const done  = isTaskDone(task);
                                const badge = getDueBadge(task);
                                const BadgeIcon = badge ? BADGE_ICON[badge.icon] : null;

                                return (
                                  <TiltCard
                                    key={task.id}
                                    className={`${s.card} ${done ? s.done : ''}`}
                                    onClick={() => toggleDone(task)}
                                    done={done}
                                  >
                                    {hovered => (<>
                                      <motion.div
                                        className={`${s.circle} ${done ? s.checked : ''}`}
                                        animate={{ scale: done ? [1, 1.45, 1] : 1 }}
                                        transition={{ duration: 0.25 }}
                                      >
                                        {done && <IconCheck size={9} />}
                                      </motion.div>
                                      <div className={s.cardBody}>
                                        <div className={s.cardTitle}>{task.title}</div>
                                        {badge && (
                                          <div className={s.meta}>
                                            <span className={`${s.badge} ${BADGE_CLS[badge.cls]}`}>
                                              {BadgeIcon && <BadgeIcon size={10} />} {badge.text}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <AnimatePresence>
                                        {hovered && (
                                          <motion.div
                                            className={s.cardActions}
                                            initial={{ opacity: 0, x: 8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 8 }}
                                            transition={{ duration: 0.13 }}
                                            onClick={e => e.stopPropagation()}
                                          >
                                            <button className={s.ib} onClick={() => openEdit(task)} title="Edit">
                                              <IconEdit size={14} />
                                            </button>
                                            <button className={`${s.ib} ${s.ibDel}`} onClick={() => deleteTask(task.id)} title="Delete">
                                              <IconTrash size={14} />
                                            </button>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </>)}
                                  </TiltCard>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {modal && (
        <TaskModal
          modal={modal}
          memberName={members.find(m => memberSlug(m.name) === modal.person)?.name || modal.person}
          onConfirm={handleModalConfirm}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function TiltCard({ className, onClick, done, children }) {
  const { ref, rotateX, rotateY, onMouseMove, onMouseLeave } = useTilt(6);
  const [hovered, setHovered] = useState(false);
  const controls = useAnimation();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (done) controls.start({
      boxShadow: ['0 0 0px rgba(80,200,120,0)', '0 0 22px rgba(80,200,120,0.5)', '0 0 0px rgba(80,200,120,0)'],
      transition: { duration: 0.55 },
    });
  }, [done]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      animate={controls}
      onMouseMove={e => { setHovered(true); onMouseMove(e); }}
      onMouseLeave={e => { setHovered(false); onMouseLeave(e); }}
      onClick={onClick}
      whileHover={{ scale: 1.02, boxShadow: '0 14px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)' }}
      transition={{ scale: { type: 'spring', stiffness: 400, damping: 25 }, boxShadow: { duration: 0.15 } }}
    >
      {typeof children === 'function' ? children(hovered) : children}
    </motion.div>
  );
}
