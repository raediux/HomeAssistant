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
  const submitBtn = document.getElementById('pin-submit');
  submitBtn.addEventListener('click', checkPin);
  submitBtn.addEventListener('touchend', e => { e.preventDefault(); checkPin(); });
})();

document.getElementById('add-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeAddModal();
});

// ── PWA detection ─────────────────────────────────────────────
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
  document.body.classList.add('pwa');
  document.documentElement.classList.add('pwa');
}

document.getElementById('version-label').textContent = 'v' + APP_VERSION;

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
const STORES = ['Woolworths','Coles','Aldi','Asian Grocer','Korean Grocer','Butcher','Big W','Chemist Warehouse','Pharmacy 4 Less','Kmart','Target','Ray Mum','Others'];
let editState = null; // { id, type: 'working'|'past' }
let collapsed = {};
let collapsedPast = {};

let workingItems = [];
let pastItems = [];
let nextId = 100;

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
  STORES.forEach(s => { groups[s] = []; });
  workingItems.forEach(item => {
    const s = STORES.includes(item.store) ? item.store : 'Others';
    groups[s].push(item);
  });

  el.innerHTML = STORES.filter(s => groups[s].length > 0).map(s => {
    const items = groups[s];
    const isCollapsed = collapsed[s];
    const itemsHtml = items.map(item => `
      <div class="s-item${item.got ? ' done' : ''}">
        <div class="circle${item.got ? ' checked' : ''}" style="flex-shrink:0" onclick="toggleGot(${item.id})">
          ${item.got ? '<i class="ti ti-check"></i>' : ''}
        </div>
        <div class="s-move-zone" onclick="moveToArchive(${item.id})">
          <div class="s-name">${esc(item.name)}</div>
        </div>
        <div class="item-actions">
          <button class="move-btn edt" title="Edit" onclick="editWorkingItem(${item.id})">
            <i class="ti ti-pencil" aria-hidden="true"></i>
          </button>
          <button class="move-btn del" title="Delete" onclick="deleteWorkingItem(${item.id})">
            <i class="ti ti-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>`).join('');
    return `
      <div class="cat-section">
        <div class="cat-header" onclick="toggleCat('${s}')">
          <span class="cat-label">${s}</span>
          <span class="cat-line"></span>
          <span class="cat-count">${items.length}</span>
          <button class="cat-add-btn" title="Add to ${s}" onclick="event.stopPropagation();addToStore('${s}')"><i class="ti ti-plus"></i></button>
          <i class="ti ti-chevron-down cat-chevron${isCollapsed ? ' collapsed' : ''}" aria-hidden="true"></i>
        </div>
        <div class="cat-body${isCollapsed ? ' collapsed' : ''}">${itemsHtml}</div>
      </div>`;
  }).join('');
}

function toggleCat(s) {
  collapsed[s] = !collapsed[s];
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
  STORES.forEach(s => { groups[s] = []; });
  filtered.forEach(item => {
    const s = STORES.includes(item.store) ? item.store : 'Others';
    groups[s].push(item);
  });

  el.innerHTML = STORES.filter(s => groups[s].length > 0).map(s => {
    const items = groups[s];
    const isCollapsed = collapsedPast[s];
    return `
      <div class="cat-section">
        <div class="cat-header" onclick="togglePastCat('${s}')">
          <span class="cat-label">${s}</span>
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
    <div class="p-item">
      <div class="p-move-zone" onclick="moveToList(${item.id})">
        <div class="p-name">${esc(item.name)}</div>
      </div>
      <div class="item-actions">
        <button class="move-btn edt" title="Edit" onclick="editPastItem(${item.id})">
          <i class="ti ti-pencil" aria-hidden="true"></i>
        </button>
        <button class="move-btn del" title="Delete" onclick="deletePastItem(${item.id})">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
}

function togglePastCat(s) {
  collapsedPast[s] = !collapsedPast[s];
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
  const working = { id: item.id, name: item.name, qty: null, store: item.store, got: false };
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
    const past = { id: item.id, name: item.name, store: item.store, times: 1 };
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

function addToStore(store) {
  document.getElementById('modal-cat').value = store;
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 50);
}

function editWorkingItem(id) {
  const item = workingItems.find(i => i.id === id);
  if (!item) return;
  editState = { id, type: 'working' };
  document.getElementById('modal-name').value = item.name;
  document.getElementById('modal-cat').value = STORES.includes(item.store) ? item.store : 'Others';
  document.querySelector('#add-modal .modal-hdr span').textContent = 'Edit item';
  document.querySelector('#add-modal .btn-primary').innerHTML = '<i class="ti ti-check"></i> Save';
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 50);
}

function editPastItem(id) {
  const item = pastItems.find(i => i.id === id);
  if (!item) return;
  editState = { id, type: 'past' };
  document.getElementById('modal-name').value = item.name;
  document.getElementById('modal-cat').value = STORES.includes(item.store) ? item.store : 'Others';
  document.querySelector('#add-modal .modal-hdr span').textContent = 'Edit item';
  document.querySelector('#add-modal .btn-primary').innerHTML = '<i class="ti ti-check"></i> Save';
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 50);
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  document.getElementById('modal-name').value = '';
  if (editState) {
    editState = null;
    document.querySelector('#add-modal .modal-hdr span').textContent = 'Add item';
    document.querySelector('#add-modal .btn-primary').innerHTML = '<i class="ti ti-plus"></i> Add to list';
  }
}

function confirmAdd() {
  const name = document.getElementById('modal-name').value.trim();
  if (!name) { document.getElementById('modal-name').focus(); return; }
  const store = document.getElementById('modal-cat').value;
  if (editState) {
    if (editState.type === 'working') {
      const item = workingItems.find(i => i.id === editState.id);
      if (item) { item.name = name; item.store = store; dbSaveWorkingItem(item); }
    } else {
      const item = pastItems.find(i => i.id === editState.id);
      if (item) { item.name = name; item.store = store; dbSavePastItem(item); }
    }
    closeAddModal();
    render();
    return;
  }
  const item = { id: nextId++, name, qty: null, store, got: false };
  workingItems.push(item);
  closeAddModal();
  render();
  dbSaveWorkingItem(item);
}

function deleteWorkingItem(id) {
  const idx = workingItems.findIndex(i => i.id === id);
  if (idx === -1) return;
  workingItems.splice(idx, 1);
  render();
  dbDeleteWorkingItem(id);
}

function deletePastItem(id) {
  const idx = pastItems.findIndex(i => i.id === id);
  if (idx === -1) return;
  pastItems.splice(idx, 1);
  render();
  dbDeletePastItem(id);
}

document.addEventListener('DOMContentLoaded', async () => {
  [workingItems, pastItems] = await Promise.all([dbLoadWorkingItems(), dbLoadPastItems()]);
  if (workingItems.length || pastItems.length) {
    const maxId = Math.max(...workingItems.map(i => i.id), ...pastItems.map(i => i.id), nextId - 1);
    nextId = maxId + 1;
  }
  render();
});
