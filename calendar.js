// ── Calendar state ─────────────────────────────────────────────
let _calYear  = null;
let _calMonth = null;
let _calSelectedDate = null;

const _CAL_MONTH_NAMES = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
const _CAL_DAY_HDRS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const _CAL_FULL_DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const _PERSON_COLORS = { ray: '#4a8fd4', jazelle: '#c46090', linus: '#c9a838' };
const _PERSON_LABELS = { ray: 'Ray', jazelle: 'Jazelle', linus: 'Linus' };

// Convert JS getDay() (0=Sun) to Mon-based dow (0=Mon)
function _monDow(jsDay) { return (jsDay + 6) % 7; }

// Returns YYYY-MM-DD strings in the month that match a Mon-based dow
function _getDowDates(year, month, dow) {
  const out = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (_monDow(d.getDay()) === dow) out.push(_toDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function _toDateStr(d) {
  return d.toISOString().split('T')[0];
}

// Build map: dateStr → [task, ...] — skips daily and completed tasks
function _buildTaskMap(year, month) {
  const map = {};
  for (const t of tasks) {
    if (t.frequency === 'daily' || t.frequency === 'weekly') continue;
    if (isTaskDone(t)) continue;
    if (t.frequency === 'occasional' && t.dueDate) {
      const d = new Date(t.dueDate + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month)
        (map[t.dueDate] = map[t.dueDate] || []).push(t);
    } else if (t.frequency === 'weekly' && t.dow !== null && t.dow !== undefined) {
      for (const ds of _getDowDates(year, month, t.dow))
        (map[ds] = map[ds] || []).push(t);
    }
  }
  return map;
}

function _fmtDetailDate(ds) {
  const d = new Date(ds + 'T00:00:00');
  return `${_CAL_FULL_DAYS[d.getDay()]}, ${d.getDate()} ${_CAL_MONTH_NAMES[d.getMonth()]}`;
}

// ── Detail panel ───────────────────────────────────────────────
function _renderDetail(dateStr, taskMap) {
  const el = document.getElementById('cal-detail');
  if (!dateStr) {
    el.innerHTML = '<div class="cal-detail-empty">Select a day</div>';
    return;
  }
  const tlist = taskMap[dateStr] || [];
  const head = `<div class="cal-detail-date">${_fmtDetailDate(dateStr)}</div>`;
  if (!tlist.length) {
    el.innerHTML = head + '<div class="cal-detail-empty">No tasks this day</div>';
    return;
  }
  el.innerHTML = head + tlist.map(t => {
    const color = _PERSON_COLORS[t.person] || '#888';
    const label = _PERSON_LABELS[t.person] || t.person;
    return `<div class="cal-task-row">
      <div class="cal-task-dot" style="background:${color}"></div>
      <div>
        <div class="cal-task-title">${esc(t.title)}</div>
        <div class="cal-task-person">${label}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Grid ───────────────────────────────────────────────────────
function _renderGrid(year, month, taskMap) {
  const todayStr   = _toDateStr(new Date());
  const firstDay   = new Date(year, month, 1);
  const startDow   = _monDow(firstDay.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = _CAL_DAY_HDRS.map(d => `<div class="cal-day-hdr">${d}</div>`).join('');
  for (let i = 0; i < startDow; i++) html += '<div class="cal-day empty"></div>';

  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayTasks = taskMap[ds] || [];
    const shown    = dayTasks.slice(0, 2);
    const overflow = dayTasks.length - 2;
    const badges   = shown.map(t => {
      const color = _PERSON_COLORS[t.person];
      return `<div class="cal-badge" style="background:${color}22;color:${color}">${esc(t.title)}</div>`;
    }).join('');
    const moreBadge = overflow > 0 ? `<div class="cal-badge-more">+${overflow} more</div>` : '';
    const classes  = ['cal-day',
      ds === todayStr         ? 'today'    : '',
      ds === _calSelectedDate ? 'selected' : '',
    ].filter(Boolean).join(' ');
    html += `<div class="${classes}" data-date="${ds}">
      <div class="cal-day-num">${day}</div>
      ${badges}${moreBadge}
    </div>`;
  }

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => {
      grid.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      _calSelectedDate = cell.dataset.date;
      _renderDetail(_calSelectedDate, taskMap);
    });
  });
}

// ── Public entry point ─────────────────────────────────────────
function renderCalendar() {
  const now = new Date();
  if (_calYear === null) {
    _calYear = now.getFullYear();
    _calMonth = now.getMonth();
    _calSelectedDate = _toDateStr(now);
  }

  document.getElementById('cal-month-label').textContent =
    `${_CAL_MONTH_NAMES[_calMonth]} ${_calYear}`;

  const taskMap = _buildTaskMap(_calYear, _calMonth);
  _renderGrid(_calYear, _calMonth, taskMap);
  _renderDetail(_calSelectedDate, taskMap);
}

// ── Nav buttons ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cal-prev').addEventListener('click', () => {
    _calMonth--;
    if (_calMonth < 0) { _calMonth = 11; _calYear--; }
    _calSelectedDate = null;
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    _calMonth++;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    _calSelectedDate = null;
    renderCalendar();
  });
});
