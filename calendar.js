// ── Calendar state ─────────────────────────────────────────────
let _calYear  = null;
let _calMonth = null;
let _calSelectedDate = null;
let _badges = [];

const _CAL_MONTH_NAMES = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
const _CAL_DAY_HDRS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const _CAL_FULL_DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const _PERSON_COLORS = { ray: '#4a8fd4', jazelle: '#c46090', linus: '#c9a838' };
const _PERSON_LABELS = { ray: 'Ray', jazelle: 'Jazelle', linus: 'Linus' };

const _BADGE_SWATCHES = [
  { color: '#4a8fd4', label: 'Blue'   },
  { color: '#c46090', label: 'Pink'   },
  { color: '#c9a838', label: 'Yellow' },
  { color: '#5a9e5a', label: 'Green'  },
];

// Convert JS getDay() (0=Sun) to Mon-based dow (0=Mon)
function _monDow(jsDay) { return (jsDay + 6) % 7; }

function _toDateStr(d) {
  return d.toISOString().split('T')[0];
}

// Build map: dateStr → [task, ...] — skips daily, weekly and completed tasks
function _buildTaskMap(year, month) {
  const map = {};
  for (const t of tasks) {
    if (t.frequency === 'daily' || t.frequency === 'weekly') continue;
    if (isTaskDone(t)) continue;
    if (t.frequency === 'occasional' && t.dueDate) {
      const d = new Date(t.dueDate + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month)
        (map[t.dueDate] = map[t.dueDate] || []).push(t);
    }
  }
  return map;
}

// Build map: dateStr → [badge, ...] for the current month
function _buildBadgeMap(year, month) {
  const map = {};
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  for (const b of _badges) {
    if (b.date.startsWith(prefix))
      (map[b.date] = map[b.date] || []).push(b);
  }
  return map;
}

function _fmtDetailDate(ds) {
  const d = new Date(ds + 'T00:00:00');
  return `${_CAL_FULL_DAYS[d.getDay()]}, ${d.getDate()} ${_CAL_MONTH_NAMES[d.getMonth()]}`;
}

// ── Detail panel ───────────────────────────────────────────────
function _renderDetail(dateStr, taskMap, badgeMap) {
  const el = document.getElementById('cal-detail');
  if (!dateStr) {
    el.innerHTML = '<div class="cal-detail-empty">Select a day</div>';
    return;
  }

  const tlist  = taskMap[dateStr]  || [];
  const blist  = badgeMap[dateStr] || [];
  const head   = `<div class="cal-detail-date">${_fmtDetailDate(dateStr)}</div>`;

  // Tasks section
  const taskRows = tlist.length
    ? `<div class="cal-detail-section">Tasks</div>` + tlist.map(t => {
        const color = _PERSON_COLORS[t.person] || '#888';
        const label = _PERSON_LABELS[t.person] || t.person;
        return `<div class="cal-task-row">
          <div class="cal-task-dot" style="background:${color}"></div>
          <div>
            <div class="cal-task-title">${esc(t.title)}</div>
            <div class="cal-task-person">${label}</div>
          </div>
        </div>`;
      }).join('')
    : '';

  // Badges section
  const badgeRows = blist.length
    ? `<div class="cal-detail-section">Badges</div>` + blist.map(b =>
        `<div class="cal-badge-row">
          <div class="cal-badge" style="background:${b.color}22;color:${b.color};flex:1">${esc(b.label)}</div>
          <button class="cal-badge-del" onclick="_deleteBadge(${b.id})" title="Remove">×</button>
        </div>`
      ).join('')
    : '';

  // Add badge form
  const swatches = _BADGE_SWATCHES.map((s, i) =>
    `<button type="button" class="cal-swatch${i === 0 ? ' selected' : ''}"
      style="background:${s.color}" data-color="${s.color}" title="${s.label}"></button>`
  ).join('');

  const addForm = `
    <div class="cal-detail-section">Add badge</div>
    <div class="cal-badge-form" id="cal-badge-form">
      <input class="cal-badge-input" id="cal-badge-label" type="text" placeholder="Label… then ↵" maxlength="30">
      <div class="cal-swatches" id="cal-swatches">${swatches}</div>
    </div>`;

  el.innerHTML = head + taskRows + badgeRows + addForm;

  // Swatch selection
  el.querySelectorAll('.cal-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.cal-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Enter key on input
  document.getElementById('cal-badge-label').addEventListener('keydown', e => {
    if (e.key === 'Enter') _confirmAddBadge(dateStr);
  });
}

// ── Badge actions ──────────────────────────────────────────────
async function _confirmAddBadge(dateStr) {
  const label = document.getElementById('cal-badge-label').value.trim();
  if (!label) { document.getElementById('cal-badge-label').focus(); return; }
  const color = document.querySelector('#cal-swatches .cal-swatch.selected')?.dataset.color
    || _BADGE_SWATCHES[0].color;

  const badge = { date: dateStr, label, color };
  const newId = await dbSaveBadge(badge);
  if (newId) {
    _badges.push({ ...badge, id: newId });
    _refreshCalendar();
  }
}

async function _deleteBadge(id) {
  await dbDeleteBadge(id);
  _badges = _badges.filter(b => b.id !== id);
  _refreshCalendar();
}

function _refreshCalendar() {
  const taskMap  = _buildTaskMap(_calYear, _calMonth);
  const badgeMap = _buildBadgeMap(_calYear, _calMonth);
  _renderGrid(_calYear, _calMonth, taskMap, badgeMap);
  _renderDetail(_calSelectedDate, taskMap, badgeMap);
}

// ── Grid ───────────────────────────────────────────────────────
function _renderGrid(year, month, taskMap, badgeMap) {
  const todayStr    = _toDateStr(new Date());
  const firstDay    = new Date(year, month, 1);
  const startDow    = _monDow(firstDay.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = _CAL_DAY_HDRS.map(d => `<div class="cal-day-hdr">${d}</div>`).join('');
  for (let i = 0; i < startDow; i++) html += '<div class="cal-day empty"></div>';

  for (let day = 1; day <= daysInMonth; day++) {
    const ds        = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayTasks  = taskMap[ds]  || [];
    const dayBadges = badgeMap[ds] || [];
    const combined  = [
      ...dayTasks.map(t  => ({ label: t.title,  color: _PERSON_COLORS[t.person] })),
      ...dayBadges.map(b => ({ label: b.label,  color: b.color })),
    ];
    const shown    = combined.slice(0, 3);
    const overflow = combined.length - 3;
    const pills    = shown.map(item =>
      `<div class="cal-badge" style="background:${item.color}22;color:${item.color}">${esc(item.label)}</div>`
    ).join('');
    const moreBadge = overflow > 0 ? `<div class="cal-badge-more">+${overflow} more</div>` : '';

    const classes = ['cal-day',
      ds === todayStr         ? 'today'    : '',
      ds === _calSelectedDate ? 'selected' : '',
    ].filter(Boolean).join(' ');

    html += `<div class="${classes}" data-date="${ds}">
      <div class="cal-day-num">${day}</div>
      ${pills}${moreBadge}
    </div>`;
  }

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => {
      grid.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      _calSelectedDate = cell.dataset.date;
      _renderDetail(_calSelectedDate, taskMap, badgeMap);
    });
  });
}

// ── Public entry point ─────────────────────────────────────────
async function renderCalendar() {
  const now = new Date();
  if (_calYear === null) {
    _calYear  = now.getFullYear();
    _calMonth = now.getMonth();
    _calSelectedDate = _toDateStr(now);
    _badges = await dbLoadBadges();
  }

  document.getElementById('cal-month-label').textContent =
    `${_CAL_MONTH_NAMES[_calMonth]} ${_calYear}`;

  const taskMap  = _buildTaskMap(_calYear, _calMonth);
  const badgeMap = _buildBadgeMap(_calYear, _calMonth);
  _renderGrid(_calYear, _calMonth, taskMap, badgeMap);
  _renderDetail(_calSelectedDate, taskMap, badgeMap);
}

// ── Nav buttons ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cal-prev').addEventListener('click', () => {
    _calMonth--;
    if (_calMonth < 0) { _calMonth = 11; _calYear--; }
    _calSelectedDate = null;
    const taskMap  = _buildTaskMap(_calYear, _calMonth);
    const badgeMap = _buildBadgeMap(_calYear, _calMonth);
    document.getElementById('cal-month-label').textContent =
      `${_CAL_MONTH_NAMES[_calMonth]} ${_calYear}`;
    _renderGrid(_calYear, _calMonth, taskMap, badgeMap);
    _renderDetail(_calSelectedDate, taskMap, badgeMap);
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    _calMonth++;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    _calSelectedDate = null;
    const taskMap  = _buildTaskMap(_calYear, _calMonth);
    const badgeMap = _buildBadgeMap(_calYear, _calMonth);
    document.getElementById('cal-month-label').textContent =
      `${_CAL_MONTH_NAMES[_calMonth]} ${_calYear}`;
    _renderGrid(_calYear, _calMonth, taskMap, badgeMap);
    _renderDetail(_calSelectedDate, taskMap, badgeMap);
  });
});
