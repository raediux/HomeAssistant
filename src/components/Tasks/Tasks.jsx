import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  IconPlus, IconEdit, IconTrash, IconCheck, IconAlertCircle, IconClock, IconCalendar, IconRepeat,
  IconChevronRight, IconPencil,
} from '@tabler/icons-react';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { useUndo } from '../../contexts/UndoContext.jsx';
import { dbSaveTask, dbDeleteTask } from '../../db.js';
import { useTasksData } from '../../contexts/TasksContext.jsx';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { memberSlug, newId, todayStr, cn } from '../../utils.js';
import { markDeleted, unmarkDeleted } from '../../utils/tombstones.js';
import { isTaskDone, getDueBadge, getBucket, sortByDue, BUCKETS, toDateStr, isRepeating, nextDueDate } from './taskUtils.js';
import TaskModal from './TaskModal.jsx';
import Whiteboard from './Whiteboard.jsx';
import MemberParticles from './MemberParticles.jsx';
import ProgressRing from './ProgressRing.jsx';
import QuickAdd from './QuickAdd.jsx';
import s from './Tasks.module.css';

const BADGE_ICON = {
  red: <IconAlertCircle size={11} />, amber: <IconClock size={11} />,
  week: <IconCalendar size={11} />, later: <IconCalendar size={11} />,
};
const BADGE_CLS  = { red: s.bRed, amber: s.bAmb, week: s.bWeek, later: s.bQuiet };
const URGENT     = new Set(['overdue', 'today']);
const slugOf     = m => m.slug ?? memberSlug(m.name);

// "26 Sep" for the roll-forward toast.
function fmtDue(ds) {
  if (!ds) return '';
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function Tasks() {
  const { members } = useHousehold();
  const { scheduleDelete } = useUndo();
  const { tasks, setTasks } = useTasksData();
  const [modal, setModal] = useState(null);
  const [activeDot, setActiveDot] = useState(0);
  const [quick, setQuick] = useState({ person: null, frequency: 'daily' });
  const [wbOpen, setWbOpen] = useState(false);
  const layoutRef = useRef(null);
  const quickRef = useRef(null);
  const drawerRef = useRef(null);
  useClickOutside(drawerRef, () => setWbOpen(false));

  function handleScroll() {
    const el = layoutRef.current;
    if (!el) return;
    setActiveDot(Math.round(el.scrollLeft / el.clientWidth));
  }

  function toggleDone(task) {
    let updated;
    if (isRepeating(task) && !task.done) {
      // A repeating task doesn't stay checked — it rolls to its next occurrence.
      // Undo restores the old date, since the card no longer reads as done and
      // so can't just be un-ticked.
      const rolled = { ...task, done: false, lastDoneDate: toDateStr(new Date()), dueDate: nextDueDate(task) };
      setTasks(prev => prev.map(t => t.id === rolled.id ? rolled : t));
      scheduleDelete(
        `Done — next due ${fmtDue(rolled.dueDate)}`,
        () => dbSaveTask(rolled),
        () => {
          setTasks(prev => prev.map(t => t.id === task.id ? task : t));
          dbSaveTask(task);
        },
      );
      return;
    }
    if (task.frequency === 'occasional') {
      // lastDoneDate lets the progress ring count it as done today.
      updated = { ...task, done: !task.done, lastDoneDate: task.done ? null : toDateStr(new Date()) };
    } else {
      const done = isTaskDone(task);
      updated = { ...task, lastDoneDate: done ? null : toDateStr(new Date()) };
    }
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    dbSaveTask(updated);
  }

  function deleteTask(id, title) {
    const task = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    scheduleDelete(
      `"${title}" deleted`,
      () => { markDeleted(id); dbDeleteTask(id); },
      () => {
        if (!task) return;
        unmarkDeleted(id);
        setTasks(prev => [...prev, task]);
        dbSaveTask(task);
      },
    );
  }

  function openEdit(task) {
    setModal({ mode: 'edit', person: task.person, frequency: task.frequency, task });
  }

  function handleModalConfirm({ title, dueDate, dow, repeatInterval }) {
    if (modal.mode === 'add') {
      const task = {
        id: newId(),
        person: modal.person,
        frequency: modal.frequency,
        title, dueDate, dow, repeatInterval,
        done: false, lastDoneDate: null,
      };
      setTasks(prev => [...prev, task]);
      dbSaveTask(task);
    } else {
      // Clearing a repeat un-checks the task, so it doesn't sit permanently done.
      const updated = { ...modal.task, title, dueDate, dow, repeatInterval, done: repeatInterval ? false : modal.task.done };
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      dbSaveTask(updated);
    }
    setModal(null);
  }

  if (!members?.length) return null;

  const quickPerson = quick.person ?? slugOf(members[0]);

  function quickAdd(title) {
    const task = {
      id: newId(), person: quickPerson, frequency: quick.frequency, title,
      dueDate: null, dow: null, repeatInterval: null, done: false, lastDoneDate: null,
    };
    setTasks(prev => [...prev, task]);
    dbSaveTask(task);
  }

  // Full modal for weekday / due date / repeat, carrying over the typed title.
  function quickMore(title) {
    setModal({ mode: 'add', person: quickPerson, frequency: quick.frequency, task: title ? { title } : null });
  }

  function focusQuick(person) {
    setQuick(q => ({ ...q, person }));
    quickRef.current?.focus();
  }

  return (
    <div className={s.root}>
      <QuickAdd
        ref={quickRef}
        members={members}
        person={quickPerson}
        frequency={quick.frequency}
        onPerson={person => setQuick(q => ({ ...q, person }))}
        onFrequency={frequency => setQuick(q => ({ ...q, frequency }))}
        onAdd={quickAdd}
        onMore={quickMore}
      />

      <div className={s.dotBar}>
        {members.map((m, i) => (
          <div key={m.name} className={cn(s.dot, i === activeDot && s.dotActive)} style={{ '--dot-col': m.color }} />
        ))}
      </div>

      <div className={s.layout} ref={layoutRef} onScroll={handleScroll}>
        {members.map(member => {
          const slug = slugOf(member);
          return (
            <div
              key={slug}
              className={s.glowWrap}
              style={{ '--col': member.color, '--col-glow': member.glow, '--col-tint': member.tint, '--col-shadow': member.shadow }}
              data-person={slug}
            >
              <MemberParticles color={member.color} />
              <TaskColumn
                member={member}
                tasks={tasks.filter(t => t.person === slug)}
                onToggle={toggleDone}
                onEdit={openEdit}
                onDelete={deleteTask}
                onAdd={() => focusQuick(slug)}
              />
            </div>
          );
        })}
      </div>

      <div ref={drawerRef} className={cn(s.drawer, wbOpen && s.drawerOpen)}>
        <button className={s.drawerTab} onClick={() => setWbOpen(o => !o)} title="Whiteboard">
          <IconPencil size={16} /><span>Whiteboard</span>
        </button>
        <div className={s.drawerBody}>
          <Whiteboard />
        </div>
      </div>

      {modal && (
        <TaskModal
          modal={modal}
          memberName={members.find(m => slugOf(m) === modal.person)?.name || modal.person}
          onConfirm={handleModalConfirm}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function TaskColumn({ member, tasks, onToggle, onEdit, onDelete, onAdd }) {
  const [doneOpen, setDoneOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const prevPending = useRef(null);

  const today = todayStr();
  const live = tasks.filter(t => !isTaskDone(t));
  const doneList = tasks.filter(isTaskDone);
  // Today's progress: what's still due/overdue, plus anything ticked off today
  // (a repeating task rolls forward instead of staying done, so count it too).
  const pending = live.filter(t => URGENT.has(getBucket(t))).length;
  const doneToday = tasks.filter(t => t.lastDoneDate === today && (isTaskDone(t) || isRepeating(t))).length;
  const total = pending + doneToday;
  const clear = total > 0 && pending === 0;

  // Celebrate the moment the last task due today is ticked (not on first load).
  useEffect(() => {
    if (prevPending.current > 0 && pending === 0 && total > 0) setBurst(b => b + 1);
    prevPending.current = pending;
  }, [pending, total]);

  const sub = !total ? 'Nothing due today' : clear ? 'All done today ✓' : `${doneToday} of ${total} done today`;

  return (
    <section className={cn(s.col, clear && s.colClear)}>
      <div className={s.colHead}>
        <div className={s.ringWrap}>
          <ProgressRing pct={total ? doneToday / total : 1} label={member.name[0]} />
          {burst > 0 && <Sparks key={burst} color={member.color} />}
        </div>
        <div>
          <div className={s.colName}>{member.name}</div>
          <div className={s.colSub}>{sub}</div>
        </div>
        <button className={s.colAdd} onClick={onAdd} title={`Add task for ${member.name}`}>
          <IconPlus size={16} />
        </button>
      </div>

      {BUCKETS.map(([key, label]) => {
        const group = sortByDue(live.filter(t => getBucket(t) === key));
        if (!group.length) return null;
        return (
          <div key={key} className={s.group}>
            <div className={cn(s.gHead, s[`g_${key}`])}>
              <span className={s.gDot} />{label}<span className={s.gN}>{group.length}</span>
            </div>
            <div className={s.cards}>
              <AnimatePresence initial={false}>
                {group.map(task => (
                  <TaskCard key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}

      {!live.length && <div className={s.empty}>All clear ✨</div>}

      {doneList.length > 0 && (
        <>
          <button className={cn(s.doneRow, doneOpen && s.doneRowOpen)} onClick={() => setDoneOpen(o => !o)}>
            <IconCheck size={14} className={s.doneTick} />{doneList.length} done
            <IconChevronRight size={14} className={s.doneChev} />
          </button>
          {doneOpen && (
            <div className={s.doneList}>
              {doneList.map(task => (
                <div key={task.id} className={s.doneItem} onClick={() => onToggle(task)}>
                  <span className={cn(s.check, s.checked)}><IconCheck size={10} stroke={3} /></span>
                  <span className={s.doneTitle}>{task.title}</span>
                  <button
                    className={cn(s.ib, s.ibDel)}
                    onClick={e => { e.stopPropagation(); onDelete(task.id, task.title); }}
                    title="Delete"
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TaskCard({ task, onToggle, onEdit, onDelete }) {
  const bucket = getBucket(task);
  const urgent = bucket === 'overdue' || (bucket === 'today' && task.frequency !== 'daily');
  const badge = getDueBadge(task);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.22 }}
      className={cn(s.card, urgent && s.urgent)}
      onClick={() => onToggle(task)}
    >
      <span className={s.check}><IconCheck size={12} stroke={3} /></span>
      <div className={s.cardBody}>
        <div className={s.cardTitle}>{task.title}</div>
        <div className={s.meta}>
          {task.frequency === 'daily' && (
            <span className={cn(s.badge, s.bQuiet)}><IconRepeat size={11} />Daily</span>
          )}
          {badge && (
            <span className={cn(s.badge, BADGE_CLS[badge.tone])}>{BADGE_ICON[badge.tone]}{badge.text}</span>
          )}
          {isRepeating(task) && (
            <span className={cn(s.badge, s.bQuiet)} title={`Repeats every ${task.repeatInterval} week${task.repeatInterval === 1 ? '' : 's'}`}>
              <IconRepeat size={11} />{task.repeatInterval}w
            </span>
          )}
        </div>
      </div>
      <div className={s.cardActions} onClick={e => e.stopPropagation()}>
        <button className={s.ib} onClick={() => onEdit(task)} title="Edit"><IconEdit size={14} /></button>
        <button className={cn(s.ib, s.ibDel)} onClick={() => onDelete(task.id, task.title)} title="Delete"><IconTrash size={14} /></button>
      </div>
    </motion.div>
  );
}

// Confetti burst from the avatar when someone clears today. The scatter
// pattern is rolled once at load — render must stay pure.
const SPARK_PATHS = Array.from({ length: 22 }, () => {
  const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
  return { '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, '--r': `${Math.random() * 360}deg` };
});

function Sparks({ color }) {
  const palette = [color, '#ffffff', '#e8c27a'];
  return (
    <div className={s.sparks}>
      {SPARK_PATHS.map((p, i) => <span key={i} className={s.spark} style={{ ...p, background: palette[i % 3] }} />)}
    </div>
  );
}
