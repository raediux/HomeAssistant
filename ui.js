// ── PIN auth ──────────────────────────────────────────────────
(async () => {
  const overlay  = document.getElementById('pin-overlay');
  const input    = document.getElementById('pin-input');
  const errMsg   = document.getElementById('pin-error');
  const remember = document.getElementById('pin-remember-check');

  const LOCKOUT_MS   = 10 * 60 * 1000; // 10 minutes
  const MAX_ATTEMPTS = 2;

  // Trusted device — skip PIN entirely
  if (localStorage.getItem('ha_trusted') === '1') {
    overlay.classList.add('hidden');
    return;
  }

  // Session already authenticated
  if (sessionStorage.getItem('ha_auth') === '1') {
    overlay.classList.add('hidden');
    return;
  }

  // Check if currently locked out
  function getLockoutRemaining() {
    const until = parseInt(localStorage.getItem('ha_lockout_until') || '0', 10);
    return Math.max(0, until - Date.now());
  }

  function applyLockout() {
    const remaining = getLockoutRemaining();
    if (remaining <= 0) return false;
    input.disabled = true;
    const mins = Math.floor(remaining / 60000);
    const secs = Math.ceil((remaining % 60000) / 1000);
    errMsg.textContent = `Too many attempts. Try again in ${mins}:${String(secs).padStart(2, '0')}`;
    errMsg.classList.add('visible');
    return true;
  }

  // Countdown ticker during lockout
  function startCountdown() {
    const timer = setInterval(() => {
      const remaining = getLockoutRemaining();
      if (remaining <= 0) {
        clearInterval(timer);
        input.disabled = false;
        input.value = '';
        errMsg.classList.remove('visible');
        errMsg.textContent = 'Incorrect PIN';
        localStorage.removeItem('ha_fail_count');
        input.focus();
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.ceil((remaining % 60000) / 1000);
        errMsg.textContent = `Too many attempts. Try again in ${mins}:${String(secs).padStart(2, '0')}`;
      }
    }, 1000);
  }

  if (applyLockout()) startCountdown();
  else input.focus();

  async function hashPin(pin) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
    return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  async function checkPin() {
    if (getLockoutRemaining() > 0) return;
    const hash = await hashPin(input.value);
    if (hash === PIN_HASH) {
      localStorage.removeItem('ha_fail_count');
      localStorage.removeItem('ha_lockout_until');
      sessionStorage.setItem('ha_auth', '1');
      if (remember.checked) localStorage.setItem('ha_trusted', '1');
      overlay.classList.add('hidden');
    } else {
      input.classList.add('shake');
      input.value = '';
      setTimeout(() => input.classList.remove('shake'), 1200);

      const fails = parseInt(localStorage.getItem('ha_fail_count') || '0', 10) + 1;
      localStorage.setItem('ha_fail_count', fails);

      if (fails >= MAX_ATTEMPTS) {
        localStorage.setItem('ha_lockout_until', Date.now() + LOCKOUT_MS);
        applyLockout();
        startCountdown();
      } else {
        errMsg.textContent = `Incorrect PIN — ${MAX_ATTEMPTS - fails} attempt${MAX_ATTEMPTS - fails === 1 ? '' : 's'} remaining`;
        errMsg.classList.add('visible');
        setTimeout(() => errMsg.classList.remove('visible'), 2000);
      }
    }
  }

  input.addEventListener('keydown', e => { if (e.key === 'Enter') checkPin(); });
})();

document.getElementById('add-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeAddModal();
});

// ── PWA detection ─────────────────────────────────────────────
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
  document.body.classList.add('pwa');
  document.documentElement.classList.add('pwa');
}

const _now = new Date();
document.getElementById('day-label').textContent = _now.toLocaleDateString('en-AU', { weekday: 'long' });
document.getElementById('date-label').textContent = _now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

function updateTime() {
  const now = new Date();
  const hm = now.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  const ampm = hm.slice(-2).toUpperCase();
  const digits = hm.slice(0, -2).trim();
  document.getElementById('time-label').innerHTML = `${digits}<span class="ampm">${ampm}</span>`;
}
updateTime();
setInterval(updateTime, 1000);

// ── Tab switching ─────────────────────────────────────────────
function switchPersonTab(person) {
  document.querySelectorAll('.mobile-person-tab').forEach(b => b.classList.toggle('active', b.dataset.person === person));
  document.querySelectorAll('.col-glow-wrap').forEach(w => w.classList.remove('mobile-active'));
  document.querySelector(`.col-glow-${person}`).classList.add('mobile-active');
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
  if (name === 'calendar') renderCalendar();
}


// ── Shopping data ─────────────────────────────────────────────
const CATEGORIES = ['Fruit & Veg', 'Meats', 'Pantry', 'Dairy & Fridge', 'Household', 'Personal', 'Other'];
let collapsed = {};
let collapsedPast = {};

let workingItems = [];
let pastItems = [];
let nextId = 100;
let draggedId = null;
let dragSource = null; // 'working' | 'past'

// ── Render ────────────────────────────────────────────────────
function render() {
  renderWorking();
  renderPast();
}

function renderWorking() {
  const el = document.getElementById('working-list');
  if (!workingItems.length) {
    el.innerHTML = '<p style="color:var(--text3);font-size:12px;text-align:center;padding:20px 0">No items — add from past purchases or create new</p>';
    return;
  }

  const groups = {};
  CATEGORIES.forEach(cat => { groups[cat] = []; });
  workingItems.forEach(item => {
    const cat = CATEGORIES.includes(item.category) ? item.category : 'Other';
    groups[cat].push(item);
  });

  el.innerHTML = CATEGORIES.filter(cat => groups[cat].length > 0).map(cat => {
    const items = groups[cat];
    const isCollapsed = collapsed[cat];
    const itemsHtml = items.map(item => `
      <div class="s-item${item.got ? ' done' : ''}"
           draggable="true" data-id="${item.id}" data-src="working"
           ondragstart="onDragStart(event)" ondragend="onDragEnd(event)">
        <i class="ti ti-grip-vertical drag-handle" aria-hidden="true"></i>
        <div class="circle${item.got ? ' checked' : ''}" style="flex-shrink:0" onclick="toggleGot(${item.id})">
          ${item.got ? '<i class="ti ti-check"></i>' : ''}
        </div>
        <div style="flex:1;min-width:0">
          <div class="s-name">${esc(item.name)}</div>
        </div>
        <button class="move-btn rem" title="Archive" onclick="moveToArchive(${item.id})">
          <i class="ti ti-arrow-right" aria-hidden="true"></i>
        </button>
      </div>`).join('');
    return `
      <div class="cat-section">
        <div class="cat-header" onclick="toggleCat('${cat}')">
          <span class="cat-label">${cat}</span>
          <span class="cat-line"></span>
          <span class="cat-count">${items.length}</span>
          <i class="ti ti-chevron-down cat-chevron${isCollapsed ? ' collapsed' : ''}" aria-hidden="true"></i>
        </div>
        <div class="cat-body${isCollapsed ? ' collapsed' : ''}">${itemsHtml}</div>
      </div>`;
  }).join('');
}

function toggleCat(cat) {
  collapsed[cat] = !collapsed[cat];
  renderWorking();
}

function renderPast(query = '') {
  const el = document.getElementById('past-list');
  const q = query.toLowerCase();
  const filtered = q ? pastItems.filter(i => i.name.toLowerCase().includes(q)) : pastItems;
  if (!filtered.length) {
    el.innerHTML = '<p style="color:var(--text3);font-size:12px;text-align:center;padding:20px 0">No matches</p>';
    return;
  }

  if (q) {
    el.innerHTML = filtered.map(item => pastItemHtml(item)).join('');
    return;
  }

  const groups = {};
  CATEGORIES.forEach(cat => { groups[cat] = []; });
  filtered.forEach(item => {
    const cat = CATEGORIES.includes(item.category) ? item.category : 'Other';
    groups[cat].push(item);
  });

  el.innerHTML = CATEGORIES.filter(cat => groups[cat].length > 0).map(cat => {
    const items = groups[cat];
    const isCollapsed = collapsedPast[cat];
    return `
      <div class="cat-section">
        <div class="cat-header" onclick="togglePastCat('${cat}')">
          <span class="cat-label">${cat}</span>
          <span class="cat-line"></span>
          <span class="cat-count">${items.length}</span>
          <i class="ti ti-chevron-down cat-chevron${isCollapsed ? ' collapsed' : ''}" aria-hidden="true"></i>
        </div>
        <div class="cat-body${isCollapsed ? ' collapsed' : ''}">
          ${items.map(item => pastItemHtml(item)).join('')}
        </div>
      </div>`;
  }).join('');
}

function pastItemHtml(item) {
  return `
    <div class="p-item" draggable="true" data-id="${item.id}" data-src="past"
         ondragstart="onDragStart(event)" ondragend="onDragEnd(event)">
      <i class="ti ti-grip-vertical drag-handle" aria-hidden="true"></i>
      <div style="flex:1;min-width:0">
        <div class="p-name">${esc(item.name)}</div>
      </div>
      <button class="move-btn add" title="Add to list" onclick="moveToList(${item.id})">
        <i class="ti ti-arrow-left" aria-hidden="true"></i>
      </button>
    </div>`;
}

function togglePastCat(cat) {
  collapsedPast[cat] = !collapsedPast[cat];
  renderPast(document.getElementById('past-search').value);
}

function filterPast() {
  renderPast(document.getElementById('past-search').value);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Move actions ──────────────────────────────────────────────
function moveToList(id) {
  const idx = pastItems.findIndex(i => i.id === id);
  if (idx === -1) return;
  const item = pastItems.splice(idx, 1)[0];
  const working = { id: item.id, name: item.name, qty: null, store: item.store, got: false, category: item.category || 'Other' };
  workingItems.push(working);
  render();
  dbDeletePastItem(item.id);
  dbSaveWorkingItem(working);
}

function moveToArchive(id) {
  const idx = workingItems.findIndex(i => i.id === id);
  if (idx === -1) return;
  const item = workingItems.splice(idx, 1)[0];
  dbDeleteWorkingItem(item.id);
  const existing = pastItems.find(p => p.name.toLowerCase() === item.name.toLowerCase());
  if (existing) {
    existing.times++;
    dbSavePastItem(existing);
  } else {
    const past = { id: item.id, name: item.name, store: item.store, times: 1, category: item.category || 'Other' };
    pastItems.unshift(past);
    dbSavePastItem(past);
  }
  render();
}

function toggleGot(id) {
  const item = workingItems.find(i => i.id === id);
  if (item) { item.got = !item.got; render(); dbSaveWorkingItem(item); }
}

function addToList() {
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 50);
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  document.getElementById('modal-name').value = '';
  document.getElementById('modal-store').value = '';
}

function confirmAdd() {
  const name = document.getElementById('modal-name').value.trim();
  if (!name) { document.getElementById('modal-name').focus(); return; }
  const category = document.getElementById('modal-cat').value;
  const store    = document.getElementById('modal-store').value.trim() || null;
  const item = { id: nextId++, name, qty: null, store, got: false, category };
  workingItems.push(item);
  closeAddModal();
  render();
  dbSaveWorkingItem(item);
}

// ── Drag and drop ─────────────────────────────────────────────
function onDragStart(e) {
  draggedId = parseInt(e.currentTarget.dataset.id);
  dragSource = e.currentTarget.dataset.src;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';

  const targetZone = dragSource === 'working'
    ? document.getElementById('past-dropzone')
    : document.getElementById('working-dropzone');
  targetZone.classList.add('active');
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.getElementById('working-dropzone').classList.remove('active');
  document.getElementById('past-dropzone').classList.remove('active');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// Set up drop zones on panels
document.addEventListener('DOMContentLoaded', async () => {
  setupDropZone(document.getElementById('working-panel'), 'working');
  setupDropZone(document.getElementById('past-panel'), 'past');

  [workingItems, pastItems] = await Promise.all([dbLoadWorkingItems(), dbLoadPastItems()]);
  if (workingItems.length || pastItems.length) {
    const maxId = Math.max(...workingItems.map(i => i.id), ...pastItems.map(i => i.id), nextId - 1);
    nextId = maxId + 1;
  }
  render();
});

function setupDropZone(panel, target) {
  panel.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSource !== target) panel.style.outline = '2px solid var(--accent)';
  });
  panel.addEventListener('dragleave', e => {
    if (!panel.contains(e.relatedTarget)) panel.style.outline = '';
  });
  panel.addEventListener('drop', e => {
    e.preventDefault();
    panel.style.outline = '';
    if (dragSource === target || draggedId === null) return;
    if (target === 'working') moveToList(draggedId);
    else moveToArchive(draggedId);
    draggedId = null;
    dragSource = null;
  });
}
