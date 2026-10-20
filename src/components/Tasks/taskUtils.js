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

const DOW_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function midnightToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d;
}

// Days until the task's next due date (negative = overdue), or null if it has
// no date. A weekly task already done this week counts forward to next week.
export function daysUntilDue(task) {
  const today = midnightToday();
  if (task.frequency === 'weekly') {
    if (task.dow === null || task.dow === undefined) return null;
    const diff = task.dow - (today.getDay() + 6) % 7;
    return diff < 0 && isTaskDone(task) ? diff + 7 : diff;
  }
  if (task.frequency !== 'occasional' || !task.dueDate) return null;
  return Math.round((new Date(task.dueDate + 'T00:00:00') - today) / 86400000);
}

// Which urgency group a task sits in on the Tasks board.
export const BUCKETS = [
  ['overdue', 'Overdue'], ['today', 'Today'], ['week', 'This week'], ['occasional', 'Occasional'],
];
export function getBucket(task) {
  if (task.frequency === 'daily') return 'today';
  const diff = daysUntilDue(task);
  if (diff === null) return task.frequency === 'weekly' ? 'week' : 'occasional';
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return diff < 7 ? 'week' : 'occasional';
}

// tone: red (overdue) · amber (due today) · week (member tint) · later (quiet)
export function getDueBadge(task) {
  const diff = daysUntilDue(task);
  if (diff === null) return null;
  if (diff < 0) return { text: `Overdue · ${-diff}d`, tone: 'red' };
  if (diff === 0) return { text: 'Due today', tone: 'amber' };
  const d = midnightToday(); d.setDate(d.getDate() + diff);
  if (diff < 7) return { text: `${DOW_SHORT[(d.getDay() + 6) % 7]} · ${diff === 1 ? 'Tomorrow' : diff + 'd'}`, tone: 'week' };
  return { text: `${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} · ${diff}d`, tone: 'later' };
}

// Soonest first; undated tasks keep their order at the end.
export function sortByDue(tasks) {
  return [...tasks].sort((a, b) => (daysUntilDue(a) ?? Infinity) - (daysUntilDue(b) ?? Infinity));
}
