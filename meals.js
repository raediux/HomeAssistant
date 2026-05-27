let mpWeekStart = null;
let mpMeals = {};
let mpPending = null;

const MP_KEY = 'mp-meals';
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function mpInit() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const dow = today.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  mpWeekStart = new Date(today);
  mpWeekStart.setDate(today.getDate() + diff);
  try { mpMeals = JSON.parse(localStorage.getItem(MP_KEY) || '{}'); } catch(e) { mpMeals = {}; }
  mpRender();
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
  return `Mon ${sStr} – Sun ${e.getDate()} ${MONTH_NAMES[e.getMonth()]}`;
}

const PEOPLE = ['couple', 'linus'];
const PEOPLE_LABELS = { couple: 'Ray & Jazelle', linus: 'Linus' };

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
    const personRows = PEOPLE.map(p => {
      const pData = dayData[p] || {};
      return `<div class="mp-person-row ${p}">
        <div class="mp-person-name">${PEOPLE_LABELS[p]}</div>
        ${mpCell(key, p, 'lunch', pData.lunch)}
        ${mpCell(key, p, 'dinner', pData.dinner)}
      </div>`;
    }).join('');
    row.innerHTML = `
      <div class="mp-day-label${key === todayKey ? ' today' : ''}">
        <div class="mp-day-name">${DAY_NAMES[i]}</div>
        <div class="mp-day-date">${d.getDate()}</div>
      </div>
      <div class="mp-persons">${personRows}</div>`;
    grid.appendChild(row);
  }
}

function mpCell(key, person, slot, meal) {
  const body = meal
    ? `<div class="mp-cell-filled">
        <span class="mp-cell-name">${mpLinkify(meal)}</span>
        <button class="mp-cell-rm" onclick="mpRemove('${key}','${person}','${slot}')" title="Remove"><i class="ti ti-x"></i></button>
       </div>`
    : `<button class="mp-cell-add" onclick="mpOpen('${key}','${person}','${slot}')"><i class="ti ti-plus" style="font-size:11px"></i> Add</button>`;
  return `<div class="mp-cell"><div class="mp-cell-body">${body}</div></div>`;
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

function confirmMeal() {
  const val = document.getElementById('meal-modal-input').value.trim();
  if (!val || !mpPending) return;
  const { dateKey, person, slot } = mpPending;
  if (!mpMeals[dateKey]) mpMeals[dateKey] = {};
  if (!mpMeals[dateKey][person]) mpMeals[dateKey][person] = {};
  mpMeals[dateKey][person][slot] = val;
  localStorage.setItem(MP_KEY, JSON.stringify(mpMeals));
  closeMealModal();
  mpRender();
}

function mpRemove(dateKey, person, slot) {
  if (!mpMeals[dateKey]?.[person]) return;
  delete mpMeals[dateKey][person][slot];
  const p = mpMeals[dateKey][person];
  if (!p.lunch && !p.dinner) delete mpMeals[dateKey][person];
  if (!PEOPLE.some(p => mpMeals[dateKey]?.[p])) delete mpMeals[dateKey];
  localStorage.setItem(MP_KEY, JSON.stringify(mpMeals));
  mpRender();
}

document.addEventListener('DOMContentLoaded', () => {
  mpInit();
  document.getElementById('meal-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('meal-modal')) closeMealModal();
  });
});
