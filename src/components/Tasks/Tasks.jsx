import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useTilt } from '../../hooks/useTilt.js';
import { IconPlus, IconEdit, IconTrash, IconCheck, IconAlertCircle, IconClock, IconCalendar } from '@tabler/icons-react';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { useUndo } from '../../contexts/UndoContext.jsx';
import { dbSaveTask, dbDeleteTask } from '../../db.js';
import { useTasksData } from '../../contexts/TasksContext.jsx';
import { memberSlug } from '../../utils.js';
import { isTaskDone, getDueBadge, sortTasks, toDateStr } from './taskUtils.js';
import { FREQUENCIES, FREQ_LABEL } from '../../config/tasks.js';
import TaskModal from './TaskModal.jsx';
import Whiteboard from './Whiteboard.jsx';
import MemberParticles from './MemberParticles.jsx';
import s from './Tasks.module.css';

const BADGE_ICON  = { 'ti-alert-circle': IconAlertCircle, 'ti-clock': IconClock, 'ti-calendar': IconCalendar };
const BADGE_CLS   = { 'b-red': s.bRed, 'b-amb': s.bAmb, 'b-blue': s.bBlue };

export default function Tasks() {
  const { members } = useHousehold();
  const { scheduleDelete } = useUndo();
  const { tasks, setTasks } = useTasksData();
  const [modal, setModal] = useState(null);
  const [activeDot, setActiveDot] = useState(0);
  const nextId = useRef(200);
  const nextIdInit = useRef(false);
  const layoutRef = useRef(null);

  useEffect(() => {
    if (!nextIdInit.current && tasks.length > 0) {
      nextIdInit.current = true;
      nextId.current = Math.max(...tasks.map(t => t.id)) + 1;
    }
  }, [tasks]);

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

  function deleteTask(id, title) {
    setTasks(prev => prev.filter(t => t.id !== id));
    scheduleDelete(`"${title}" deleted`, () => dbDeleteTask(id));
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div className={s.dotBar}>
        {members.map((m, i) => (
          <div
            key={m.name}
            className={`${s.dot} ${i === activeDot ? s.dotActive : ''}`}
            style={{ '--dot-col': m.color }}
          />
        ))}
        <div
          className={`${s.dot} ${members.length === activeDot ? s.dotActive : ''}`}
          style={{ '--dot-col': 'rgba(255,255,255,0.5)' }}
        />
      </div>

      <div className={s.layout} ref={layoutRef} onScroll={handleScroll}>
        {members.map((member, idx) => {
          const slug = member.slug ?? memberSlug(member.name);
          return (
            <div
              key={slug}
              className={s.glowWrap}
              style={{ '--col': member.color, '--col-glow': member.glow, '--col-tint': member.tint, '--col-shadow': member.shadow }}
              data-person={slug}
            >
              <MemberParticles color={member.color} />
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
                                            <button className={`${s.ib} ${s.ibDel}`} onClick={() => deleteTask(task.id, task.title)} title="Delete">
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

        <div className={s.glowWrap}>
          <div className={s.column}>
            <Whiteboard />
          </div>
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
    </div>
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
      style={{ rotateX, rotateY, transformPerspective: 800, transformStyle: 'preserve-3d' }}
      animate={controls}
      onMouseMove={e => { setHovered(true); onMouseMove(e); }}
      onMouseLeave={e => { setHovered(false); onMouseLeave(e); }}
      onClick={onClick}
      whileHover={{ scale: 1.02, boxShadow: '0 14px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)' }}
      whileTap={{ scale: 0.95 }}
      transition={{ scale: { type: 'spring', stiffness: 500, damping: 18 }, boxShadow: { duration: 0.15 } }}
    >
      {typeof children === 'function' ? children(hovered) : children}
      {/* depth face — visible on tilt */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: 'inherit',
        background: 'rgba(0,0,0,0.55)',
        transform: 'translateZ(-6px)',
        pointerEvents: 'none',
      }} />
    </motion.div>
  );
}
