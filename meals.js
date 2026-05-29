let mpWeekStart = null;
let mpMeals = {};
let mpPending = null;

const MEMBER_COLORS = ['var(--accent)', 'var(--pink)', 'var(--yellow)', '#64c882'];
const COUPLE_SIZE = 2;

function mpShopTab(btn) {
  const panels = document.querySelector('.mp-col-shopping .shopping-panels');
  const target = document.getElementById(btn.dataset.panel);
  panels.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
}

function mpInitShopTabs() {
  const panels = document.querySelector('.mp-col-shopping .shopping-panels');
  if (!panels) return;
  panels.addEventListener('scroll', () => {
    const tabs = document.querySelectorAll('.mp-shop-tab');
    const mid = panels.scrollLeft + panels.clientWidth / 2;
    tabs.forEach(t => {
      const el = document.getElementById(t.dataset.panel);
      const active = el && el.offsetLeft <= mid && el.offsetLeft + el.offsetWidth > mid;
      t.classList.toggle('active', active);
    });
  }, { passive: true });
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function mpInit() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const dow = today.getDay();
  mpWeekStart = new Date(today);
  mpWeekStart.setDate(today.getDate() - dow);
  const rows = await dbLoadMeals();
  mpMeals = {};
  for (const r of rows) {
    if (!mpMeals[r.date]) mpMeals[r.date] = {};
    if (!mpMeals[r.date][r.person]) mpMeals[r.date][r.person] = {};
    mpMeals[r.date][r.person][r.slot] = r.meal;
  }
  mpRender();
  mpInitShopTabs();
}

function mpDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function mpWeekLabel() {
  const end = new Date(mpWeekStart);
  end.setDate(mpWeekStart.getDate() + 6);
  const s = mpWeekStart, e = end;
  const crossMonth = s.getMonth() !== e.getMonth();
  const sStr = crossMonth ? `${s.getDate()} ${MONTH_NAMES[s.getMonth()]}` : `${s.getDate()}`;
  return `Sun ${sStr} – Sat ${e.getDate()} ${MONTH_NAMES[e.getMonth()]}`;
}

function mpRender() {
  document.getElementById('mp-week-label').textContent = mpWeekLabel();
  const todayKey = mpDateKey(new Date());
  const grid = document.getElementById('mp-grid');
  grid.innerHTML = '';
  const hdr = document.createElement('div');
  hdr.className = 'mp-grid-header';
  hdr.innerHTML = '<div class="mp-col-hdr">Lunch</div><div class="mp-col-hdr">Dinner</div>';
  grid.appendChild(hdr);
  for (let i = 0; i < 7; i++) {
    const d = new Date(mpWeekStart);
    d.setDate(mpWeekStart.getDate() + i);
    const key = mpDateKey(d);
    const dayData = mpMeals[key] || {};
    const row = document.createElement('div');
    row.className = 'mp-row';
    row.innerHTML = `
      <div class="mp-day-label${key === todayKey ? ' today' : ''}">
        <div class="mp-day-name">${DAY_NAMES[i]}</div>
        <div class="mp-day-date">${d.getDate()}</div>
      </div>
      ${mpPersonsGrid(key, dayData)}`;
    grid.appendChild(row);
  }
}

function mpIsSplit(dayData, slot) {
  return getMembers().slice(0, COUPLE_SIZE).some(m => dayData[memberSlug(m.name)]?.[slot]);
}

function mpPersonsGrid(key, dayData) {
  const members = getMembers();
  const n = members.length;
  let cells = '';
  for (let ri = 0; ri < n; ri++) {
    const m = members[ri];
    const p = memberSlug(m.name);
    const isCouple = ri < COUPLE_SIZE;
    const last = ri === n - 1;
    const color = MEMBER_COLORS[ri] || MEMBER_COLORS[0];
    const nameExtra = ri === 0 ? ' mp-gname-couple' : '';
    cells += `<div class="mp-gname${nameExtra}${last ? ' last' : ''}" style="--mb:${color}">${esc(m.name)}</div>`;
    for (const slot of ['lunch', 'dinner']) {
      if (isCouple) {
        if (mpIsSplit(dayData, slot)) {
          cells += mpSplitCoupleCell(key, p, slot, (dayData[p] || {})[slot], ri === 0, last);
        } else {
          if (ri === 0) cells += mpCoupleCell(key, slot, dayData['couple']?.[slot]);
        }
      } else {
        cells += `<div class="mp-gcell${last ? ' last' : ''}">${mpCellInner(key, p, slot, (dayData[p] || {})[slot])}</div>`;
      }
    }
  }
  return `<div class="mp-persons">${cells}</div>`;
}

function mpCoupleCell(key, slot, meal) {
  const inner = meal
    ? `<div class="mp-cell-filled" onclick="mpOpen('${key}','couple','${slot}')">
        <span class="mp-cell-name">${mpLinkify(meal)}</span>
        <button class="mp-couple-split-btn" onclick="event.stopPropagation();mpSplit('${key}','${slot}')" title="Split"><i class="ti ti-arrows-split-2"></i></button>
        <button class="mp-cell-rm" onclick="event.stopPropagation();mpRemove('${key}','couple','${slot}')" title="Remove"><i class="ti ti-x"></i></button>
       </div>`
    : `<button class="mp-cell-add" onclick="mpOpen('${key}','couple','${slot}')"><i class="ti ti-plus" style="font-size:11px"></i> Add</button>`;
  return `<div class="mp-gcell mp-gcell-couple" style="grid-row:span 2">${inner}</div>`;
}

function mpSplitCoupleCell(key, person, slot, meal, isFirst, isLast) {
  const mergeBtn = isFirst
    ? `<button class="mp-couple-merge-btn" onclick="event.stopPropagation();mpMerge('${key}','${slot}')" title="Combine"><i class="ti ti-link"></i></button>`
    : '';
  const inner = meal
    ? `<div class="mp-cell-filled" onclick="mpOpen('${key}','${person}','${slot}')">
        <span class="mp-cell-name">${mpLinkify(meal)}</span>
        ${mergeBtn}
        <button class="mp-cell-rm" onclick="event.stopPropagation();mpRemove('${key}','${person}','${slot}')" title="Remove"><i class="ti ti-x"></i></button>
       </div>`
    : `<button class="mp-cell-add" onclick="mpOpen('${key}','${person}','${slot}')"><i class="ti ti-plus" style="font-size:11px"></i> Add</button>`;
  return `<div class="mp-gcell${isLast ? ' last' : ''}">${inner}</div>`;
}

function mpCellInner(key, person, slot, meal) {
  if (meal) {
    return `<div class="mp-cell-filled" onclick="mpOpen('${key}','${person}','${slot}')">
      <span class="mp-cell-name">${mpLinkify(meal)}</span>
      <button class="mp-cell-rm" onclick="event.stopPropagation();mpRemove('${key}','${person}','${slot}')" title="Remove"><i class="ti ti-x"></i></button>
    </div>`;
  }
  return `<button class="mp-cell-add" onclick="mpOpen('${key}','${person}','${slot}')"><i class="ti ti-plus" style="font-size:11px"></i> Add</button>`;
}

function mpEsc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function mpLinkify(text) {
  const urlRe = /https?:\/\/[^\s]+/g;
  const parts = [];
  let last = 0, m;
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > last) parts.push(mpEsc(text.slice(last, m.index)));
    const url = mpEsc(m[0]);
    parts.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="mp-link" onclick="event.stopPropagation()">${url}</a>`);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(mpEsc(text.slice(last)));
  return parts.join('');
}

function mpPrevWeek() { mpWeekStart.setDate(mpWeekStart.getDate() - 7); mpRender(); }
function mpNextWeek() { mpWeekStart.setDate(mpWeekStart.getDate() + 7); mpRender(); }

function mpOpen(dateKey, person, slot) {
  mpPending = { dateKey, person, slot };
  const existing = ((mpMeals[dateKey] || {})[person] || {})[slot] || '';
  const input = document.getElementById('meal-modal-input');
  input.value = existing;
  document.getElementById('meal-modal-title').textContent = existing ? 'Edit meal' : 'Add meal';
  document.getElementById('meal-modal').classList.add('open');
  setTimeout(() => input.focus(), 60);
}

function closeMealModal() {
  document.getElementById('meal-modal').classList.remove('open');
  mpPending = null;
}

async function confirmMeal() {
  const val = document.getElementById('meal-modal-input').value.trim();
  if (!val || !mpPending) return;
  const { dateKey, person, slot } = mpPending;
  if (!mpMeals[dateKey]) mpMeals[dateKey] = {};
  if (!mpMeals[dateKey][person]) mpMeals[dateKey][person] = {};
  mpMeals[dateKey][person][slot] = val;
  closeMealModal();
  mpRender();
  await dbSaveMeal(dateKey, person, slot, val);
}

async function mpRemove(dateKey, person, slot) {
  if (!mpMeals[dateKey]?.[person]) return;
  delete mpMeals[dateKey][person][slot];
  const p = mpMeals[dateKey][person];
  if (!p.lunch && !p.dinner) delete mpMeals[dateKey][person];
  const allKeys = [...getMembers().map(m => memberSlug(m.name)), 'couple'];
  if (!allKeys.some(k => mpMeals[dateKey]?.[k])) delete mpMeals[dateKey];
  mpRender();
  await dbDeleteMeal(dateKey, person, slot);
}

async function mpSplit(key, slot) {
  const meal = mpMeals[key]?.['couple']?.[slot];
  const coupleMembers = getMembers().slice(0, COUPLE_SIZE);
  if (!mpMeals[key]) mpMeals[key] = {};
  const saves = [];
  for (const m of coupleMembers) {
    const p = memberSlug(m.name);
    if (!mpMeals[key][p]) mpMeals[key][p] = {};
    if (meal) {
      mpMeals[key][p][slot] = meal;
      saves.push(dbSaveMeal(key, p, slot, meal));
    }
  }
  if (mpMeals[key]['couple']) {
    delete mpMeals[key]['couple'][slot];
    if (!mpMeals[key]['couple'].lunch && !mpMeals[key]['couple'].dinner) delete mpMeals[key]['couple'];
  }
  mpRender();
  await Promise.all([dbDeleteMeal(key, 'couple', slot), ...saves]);
}

async function mpMerge(key, slot) {
  const coupleMembers = getMembers().slice(0, COUPLE_SIZE);
  if (!mpMeals[key]) mpMeals[key] = {};
  if (!mpMeals[key]['couple']) mpMeals[key]['couple'] = {};
  let meal = null;
  const deletes = [];
  for (const m of coupleMembers) {
    const p = memberSlug(m.name);
    if (!meal) meal = mpMeals[key][p]?.[slot] || null;
    if (mpMeals[key][p]?.[slot]) {
      delete mpMeals[key][p][slot];
      if (!mpMeals[key][p].lunch && !mpMeals[key][p].dinner) delete mpMeals[key][p];
      deletes.push(dbDeleteMeal(key, p, slot));
    }
  }
  if (meal) mpMeals[key]['couple'][slot] = meal;
  mpRender();
  await Promise.all([...deletes, ...(meal ? [dbSaveMeal(key, 'couple', slot, meal)] : [])]);
}

// mpInit() is called from ui.js initApp() after members are loaded
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('meal-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('meal-modal')) closeMealModal();
  });
});
