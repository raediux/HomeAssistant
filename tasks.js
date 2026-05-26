// ── Task state ────────────────────────────────────────────────
let tasks = [];
let nextTaskId = 200;

// ── Auto-reset helpers ────────────────────────────────────────
function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

// Returns the YYYY-MM-DD of the most recent occurrence of dow (0=Mon…6=Sun).
// If dow is null/undefined, defaults to Monday (0).
function getWeeklyResetDate(dow) {
  const target = (dow === null || dow === undefined) ? 0 : dow;
  // Convert our Mon-based dow to JS Sun-based getDay()
  const jsTarget = (target + 1) % 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysBack = (today.getDay() - jsTarget + 7) % 7;
  const reset = new Date(today);
  reset.setDate(today.getDate() - daysBack);
  return toDateStr(reset);
}

function isTaskDone(task) {
  if (task.frequency === 'occasional') return !!task.done;
  if (!task.lastDoneDate) return false;
  if (task.frequency === 'daily') return task.lastDoneDate === toDateStr(new Date());
  if (task.frequency === 'weekly') return task.lastDoneDate >= getWeeklyResetDate(task.dow);
  return false;
}
// ── Render ────────────────────────────────────────────────────
function renderTasks() {
  ['ray', 'jazelle', 'linus'].forEach(person => {
    ['daily', 'weekly', 'occasional'].forEach(frequency => {
      renderTaskList(person, frequency);
    });
  });
}

function renderTaskList(person, frequency) {
  const el = document.getElementById(`items-${person}-${frequency}`);
  if (!el) return;
  const visible = tasks.filter(t => t.person === person && t.frequency === frequency);

  if (frequency === 'occasional') {
    visible.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    });
  } else if (frequency === 'weekly') {
    visible.sort((a, b) => (a.dow ?? 0) - (b.dow ?? 0));
  } else if (frequency === 'daily') {
    visible.sort((a, b) => Number(isTaskDone(a)) - Number(isTaskDone(b)));
  }

  if (visible.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:12px;padding:8px 0">No tasks</p>';
    return;
  }
  el.innerHTML = visible.map(taskCardHTML).join('');
}

const DOW_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getDueBadge(task) {
  if (task.frequency === 'weekly') {
    if (task.dow === null || task.dow === undefined) return null;
    return { text: DOW_NAMES[task.dow], cls: 'b-blue', icon: 'ti-calendar' };
  }
  const dueDate = task.dueDate;
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diff < -1) return { text: `${Math.abs(diff)} days overdue`, cls: 'b-red',  icon: 'ti-alert-circle' };
  if (diff === -1) return { text: 'Yesterday',                    cls: 'b-red',  icon: 'ti-alert-circle' };
  if (diff === 0)  return { text: 'Due today',                    cls: 'b-red',  icon: 'ti-alert-circle' };
  if (diff === 1)  return { text: '1 day',                        cls: 'b-amb',  icon: 'ti-clock'        };
  if (diff <= 7)   return { text: `${diff} days`,                 cls: 'b-amb',  icon: 'ti-clock'        };
  return                  { text: `${diff} days`,                 cls: 'b-blue', icon: 'ti-calendar'     };
}

function taskCardHTML(task) {
  const done = isTaskDone(task);
  const badge = getDueBadge(task);
  const badgeHTML = badge
    ? `<div class="meta"><span class="badge ${badge.cls}"><i class="ti ${badge.icon}"></i> ${esc(badge.text)}</span></div>`
    : '';

  return `
    <div class="task-card${done ? ' done' : ''}" onclick="toggleTaskDone(${task.id})">
      <div class="circle${done ? ' checked' : ''}">${done ? '<i class="ti ti-check"></i>' : ''}</div>
      <div class="card-body">
        <div class="card-title">${esc(task.title)}</div>
        ${badgeHTML}
      </div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="ib" onclick="openTaskModal('edit', ${task.id})" title="Edit"><i class="ti ti-edit"></i></button>
        <button class="ib del" onclick="deleteTask(${task.id})" title="Delete"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Toggle done ───────────────────────────────────────────────
function toggleTaskDone(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (task.frequency === 'occasional') {
    task.done = !task.done;
  } else {
    const currentlyDone = isTaskDone(task);
    task.lastDoneDate = currentlyDone ? null : toDateStr(new Date());
  }
  renderTaskList(task.person, task.frequency);
  dbSaveTask(task);
}

// ── Delete ────────────────────────────────────────────────────
function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const { person, frequency } = task;
  tasks = tasks.filter(t => t.id !== id);
  renderTaskList(person, frequency);
  dbDeleteTask(id);
}

// ── Edit mode toggle ──────────────────────────────────────────
function toggleEditMode(btn) {
  const box = btn.closest('.person-box');
  const isEditing = box.classList.toggle('edit-mode');
  btn.classList.toggle('active', isEditing);
}

// ── Task modal ────────────────────────────────────────────────
const PERSON_LABELS    = { ray: 'Ray', jazelle: 'Jazelle', linus: 'Linus' };
const FREQUENCY_LABELS = { daily: 'Daily', weekly: 'Weekly', occasional: 'Occasional' };

let _modal = { mode: 'add', person: null, frequency: null, id: null };

function openTaskModal(mode, personOrId, frequency) {
  if (mode === 'add') {
    _modal = { mode: 'add', person: personOrId, frequency, id: null };
    document.getElementById('task-modal-title').textContent =
      `Add ${FREQUENCY_LABELS[frequency]} task — ${PERSON_LABELS[personOrId]}`;
    document.getElementById('task-modal-input').value = '';
    document.getElementById('task-modal-btn').textContent = 'Add task';
    _modalSetFrequencyFields(frequency, null, null);
  } else {
    const task = tasks.find(t => t.id === personOrId);
    if (!task) return;
    _modal = { mode: 'edit', person: task.person, frequency: task.frequency, id: task.id };
    document.getElementById('task-modal-title').textContent = 'Edit task';
    document.getElementById('task-modal-input').value = task.title;
    document.getElementById('task-modal-btn').textContent = 'Save';
    _modalSetFrequencyFields(task.frequency, task.dueDate, task.dow);
  }
  document.getElementById('task-modal').classList.add('open');
  setTimeout(() => document.getElementById('task-modal-input').focus(), 50);
}

function _modalSetFrequencyFields(frequency, dueDate, dow) {
  const dowWrap  = document.getElementById('task-modal-dow-wrap');
  const dateWrap = document.getElementById('task-modal-date-wrap');
  dowWrap.style.display  = frequency === 'weekly'     ? '' : 'none';
  dateWrap.style.display = frequency === 'occasional' ? '' : 'none';
  // Reset both
  document.getElementById('task-modal-date').value = dueDate || '';
  document.querySelectorAll('#task-modal-dow .dow-btn').forEach(btn => {
    btn.classList.toggle('selected', dow !== null && parseInt(btn.dataset.dow) === dow);
  });
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('open');
  _modal = { mode: 'add', person: null, frequency: null, id: null };
}

function confirmTaskModal() {
  const title = document.getElementById('task-modal-input').value.trim();
  if (!title) { document.getElementById('task-modal-input').focus(); return; }

  let dueDate = null;
  let dow = null;
  if (_modal.frequency === 'occasional') {
    dueDate = document.getElementById('task-modal-date').value || null;
  } else if (_modal.frequency === 'weekly') {
    const sel = document.querySelector('#task-modal-dow .dow-btn.selected');
    dow = sel ? parseInt(sel.dataset.dow) : null;
  }

  if (_modal.mode === 'add') {
    const task = { id: nextTaskId++, person: _modal.person, frequency: _modal.frequency, title, dueDate, dow, done: false };
    tasks.push(task);
    renderTaskList(_modal.person, _modal.frequency);
    dbSaveTask(task);
  } else {
    const task = tasks.find(t => t.id === _modal.id);
    if (task) {
      task.title = title;
      task.dueDate = dueDate;
      task.dow = dow;
      renderTaskList(task.person, task.frequency);
      dbSaveTask(task);
    }
  }
  closeTaskModal();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('task-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTaskModal();
  });
  document.getElementById('task-modal-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmTaskModal();
  });
  document.getElementById('task-modal-dow').addEventListener('click', e => {
    const btn = e.target.closest('.dow-btn');
    if (!btn) return;
    const wasSelected = btn.classList.contains('selected');
    document.querySelectorAll('#task-modal-dow .dow-btn').forEach(b => b.classList.remove('selected'));
    if (!wasSelected) btn.classList.add('selected');
  });

  tasks = await dbLoadTasks();
  // Ensure nextTaskId is above any existing ids
  if (tasks.length) nextTaskId = Math.max(...tasks.map(t => t.id)) + 1;
  renderTasks();
});
