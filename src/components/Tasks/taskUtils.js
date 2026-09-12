import { dateStr } from '../../utils.js';

// Re-exported under the historical name used across the Tasks components.
export const toDateStr = dateStr;

export function getWeeklyResetDate(dow) {
  const target = (dow === null || dow === undefined) ? 0 : dow;
  const jsTarget = (target + 1) % 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysBack = (today.getDay() - jsTarget + 7) % 7;
  const reset = new Date(today);
  reset.setDate(today.getDate() - daysBack);
  return toDateStr(reset);
}

// True for an occasional task set to repeat on a fixed cadence.
export function isRepeating(task) {
  return task.frequency === 'occasional' && !!task.repeatInterval;
}

// The next occurrence after today, anchored to the schedule rather than the
// completion date — ticking a task late keeps it on its original cadence. A
// task left overdue for several intervals skips ahead to the next real date
// instead of landing in the past.
export function nextDueDate(task) {
  const step = task.repeatInterval;
  if (!step) return task.dueDate || null;
  const unit = task.repeatUnit || 'week';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : new Date(today);

  // Always advance at least one interval (ticking early still consumes this
  // occurrence), then keep going until the date is in the future. The counter
  // guards against a bad interval spinning forever.
  let i = 0;
  do {
    if (unit === 'day')        next.setDate(next.getDate() + step);
    else if (unit === 'month') next.setMonth(next.getMonth() + step);
    else                       next.setDate(next.getDate() + step * 7);
  } while (next <= today && ++i < 500);
  return toDateStr(next);
}

export function isTaskDone(task) {
  if (task.frequency === 'occasional') return !!task.done;
  if (!task.lastDoneDate) return false;
  if (task.frequency === 'daily') return task.lastDoneDate === toDateStr(new Date());
  if (task.frequency === 'weekly') return task.lastDoneDate >= getWeeklyResetDate(task.dow);
  return false;
}

export function getDueBadge(task) {
  if (task.frequency === 'weekly') {
    if (task.dow === null || task.dow === undefined) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMF = (today.getDay() + 6) % 7;
    const diff = task.dow - todayMF;
    const dayShort = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][task.dow];
    if (diff === 0) return { text: 'Due today',             cls: 'b-red',  icon: 'ti-alert-circle' };
    if (diff > 0) {
      if (diff === 1) return { text: `${dayShort} · Tomorrow`, cls: 'b-amb',  icon: 'ti-clock' };
      return               { text: `${dayShort} · ${diff}d`,  cls: 'b-blue', icon: 'ti-calendar' };
    }
    if (!isTaskDone(task)) {
      if (diff === -1) return { text: 'Yesterday',        cls: 'b-red', icon: 'ti-alert-circle' };
      return                  { text: `${-diff}d overdue`, cls: 'b-red', icon: 'ti-alert-circle' };
    }
    const nextIn = 7 + diff;
    if (nextIn === 1) return { text: `${dayShort} · Tomorrow`,  cls: 'b-amb',  icon: 'ti-clock' };
    return                   { text: `${dayShort} · ${nextIn}d`, cls: 'b-blue', icon: 'ti-calendar' };
  }

  const dueDate = task.dueDate;
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diff < -1) return { text: `${Math.abs(diff)} days overdue`, cls: 'b-red',  icon: 'ti-alert-circle' };
  if (diff === -1) return { text: 'Yesterday',                    cls: 'b-red',  icon: 'ti-alert-circle' };
  if (diff === 0)  return { text: 'Due today',                    cls: 'b-red',  icon: 'ti-alert-circle' };
  if (diff === 1)  return { text: '1 day',                        cls: 'b-amb',  icon: 'ti-clock' };
  if (diff <= 7)   return { text: `${diff} days`,                 cls: 'b-amb',  icon: 'ti-clock' };
  return                  { text: `${diff} days`,                 cls: 'b-blue', icon: 'ti-calendar' };
}

export function sortTasks(tasks, frequency) {
  const copy = [...tasks];
  if (frequency === 'occasional') {
    copy.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    });
  } else if (frequency === 'weekly') {
    copy.sort((a, b) => (a.dow ?? 0) - (b.dow ?? 0));
  } else if (frequency === 'daily') {
    copy.sort((a, b) => Number(isTaskDone(a)) - Number(isTaskDone(b)));
  }
  return copy;
}
