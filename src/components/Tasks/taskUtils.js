export function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

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
