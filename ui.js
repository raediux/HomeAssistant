// ── Supabase Auth ──────────────────────────────────────────────
let _authMode = 'signin';

// On load: check existing session; if authed + has household, proceed immediately.
(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    const hid = await getMyHouseholdId();
    if (hid) {
      document.getElementById('auth-overlay').classList.add('hidden');
      await initApp();
      document.dispatchEvent(new Event('ha:authed'));
      populateProfileMenu();
    } else {
      showOnboarding();
    }
  }
  // else: no session → auth-overlay stays visible (it has no `hidden` class by default)

  db.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      clearHouseholdId();
      location.reload();
    }
  });
})();

function setAuthMode(mode) {
  _authMode = mode;
  document.querySelectorAll('.auth-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode)
  );
  const btn = document.getElementById('auth-submit');
  if (btn) btn.textContent = mode === 'signin' ? 'Sign in' : 'Sign up';
  const pw = document.getElementById('auth-password');
  if (pw) pw.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  document.getElementById('auth-error').textContent   = '';
  document.getElementById('auth-message').textContent = '';
}

async function authSubmit() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  const msgEl    = document.getElementById('auth-message');
  const btn      = document.getElementById('auth-submit');

  errEl.textContent = '';
  msgEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Email and password are required.'; return; }

  btn.disabled    = true;
  btn.textContent = _authMode === 'signin' ? 'Signing in…' : 'Creating account…';

  try {
    if (_authMode === 'signin') {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { data, error } = await db.auth.signUp({
        email, password,
        options: { emailRedirectTo: 'https://raediux.github.io/HomeAssistant' },
      });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation required
        msgEl.textContent = 'Check your email to confirm your account, then sign in.';
        setAuthMode('signin');
        return;
      }
    }
    // Session now exists
    const hid = await getMyHouseholdId();
    if (hid) {
      document.getElementById('auth-overlay').classList.add('hidden');
      document.dispatchEvent(new Event('ha:authed'));
      populateProfileMenu();
      location.reload();
    } else {
      showOnboarding();
    }
  } catch (e) {
    errEl.textContent = e.message || 'Authentication failed.';
    btn.disabled    = false;
    btn.textContent = _authMode === 'signin' ? 'Sign in' : 'Sign up';
  }
}

function authSignOut() {
  db.auth.signOut();
}

// ── Profile menu ───────────────────────────────────────────────
function toggleProfileMenu() {
  document.getElementById('profile-dropdown').classList.toggle('open');
}

async function populateProfileMenu() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;
  const [{ data: member }, hid] = await Promise.all([
    db.from('household_members').select('name').eq('user_id', session.user.id).maybeSingle(),
    getMyHouseholdId(),
  ]);
  const nameEl = document.getElementById('profile-display-name');
  if (nameEl) nameEl.textContent = member?.name || session.user.email || '—';
  if (hid) {
    const { data: sub } = await db.from('subscriptions').select('tier').eq('household_id', hid).maybeSingle();
    const tierEl = document.getElementById('profile-tier');
    if (tierEl) {
      const tier = sub?.tier || 'free';
      tierEl.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
      tierEl.dataset.tier = tier;
    }
  }
}

// Close profile dropdown when clicking outside it
document.addEventListener('click', e => {
  const menu = document.getElementById('profile-menu');
  if (menu && !menu.contains(e.target)) {
    document.getElementById('profile-dropdown')?.classList.remove('open');
  }
});

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
  const wrap = document.querySelector(`.col-glow-wrap[data-person="${person}"]`);
  if (wrap) wrap.classList.add('mobile-active');
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
  if (name === 'calendar') renderCalendar();
}

// ── App initialisation (runs post-auth, before ha:authed fires) ─
async function initApp() {
  const hid = await getMyHouseholdId();
  let tier = 'free';
  if (hid) {
    const { data: sub } = await db.from('subscriptions').select('tier').eq('household_id', hid).maybeSingle();
    tier = sub?.tier || 'free';
    setHouseholdTier(tier);
  }
  await dbLoadMembers();
  buildTaskColumns(tier);
  await Promise.all([initTasks(), mpInit()]);
}

// ── Shopping data ─────────────────────────────────────────────
const STORES = ['Aldi','Asian Grocer','Big W','Butcher','Chemist Warehouse','Coles','Kmart','Korean Grocer','Pharmacy 4 Less','Ray Mum','Target','Woolworths','Others'];
let editState = null; // { id, type: 'working'|'past' }
let draggedId = null;
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
    el.innerHTML = '<p style="color:var(--text3);font-size:12px;text-align:center;padding:20px 0">No items — add from All Items or create new</p>';
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
      <div class="s-item${item.got ? ' done' : ''}"
           draggable="true" data-id="${item.id}"
           ondragstart="onDragStart(event)" ondragend="onDragEnd(event)"
           ondragover="onDragOver(event)" ondrop="onDrop(event)">
        <i class="ti ti-grip-vertical drag-handle" aria-hidden="true"></i>
        <div class="circle${item.got ? ' checked' : ''}" style="flex-shrink:0" onclick="toggleGot(${item.id})">
          ${item.got ? '<i class="ti ti-check"></i>' : ''}
        </div>
        <div class="s-move-zone" onclick="toggleGot(${item.id})">
          <div class="s-name">${esc(item.name)}</div>
        </div>
        <div class="item-actions">
          <button class="move-btn edt" title="Edit" onclick="editWorkingItem(${item.id})">
            <i class="ti ti-pencil" aria-hidden="true"></i>
          </button>
          <button class="move-btn del" title="Move back to All Items" onclick="moveToArchive(${item.id})">
            <i class="ti ti-arrow-back-up" aria-hidden="true"></i>
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
  const working = { id: item.id, name: item.name, qty: null, store: item.store, got: false, sort_order: workingItems.length };
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
  document.getElementById('add-modal-btn').innerHTML = '<i class="ti ti-check"></i> Save';
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
  document.getElementById('add-modal-btn').innerHTML = '<i class="ti ti-check"></i> Save';
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 50);
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  document.getElementById('modal-name').value = '';
  if (editState) {
    editState = null;
    document.querySelector('#add-modal .modal-hdr span').textContent = 'Add item';
    document.getElementById('add-modal-btn').innerHTML = '<i class="ti ti-plus"></i> Add to list';
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
  const item = { id: nextId++, name, qty: null, store, got: false, sort_order: workingItems.length };
  workingItems.push(item);
  closeAddModal();
  render();
  dbSaveWorkingItem(item);
}

function clearAll() {
  if (!workingItems.length) return;
  const items = [...workingItems];
  workingItems = [];
  render();
  items.forEach(item => {
    dbDeleteWorkingItem(item.id);
    const existing = pastItems.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    if (existing) { existing.times++; dbSavePastItem(existing); }
    else { const past = { id: item.id, name: item.name, store: item.store, times: 1 }; pastItems.unshift(past); dbSavePastItem(past); }
  });
  renderPast();
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

// ── Drag to reorder within group ──────────────────────────────
function onDragStart(e) {
  draggedId = parseInt(e.currentTarget.dataset.id);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.s-item.drag-over').forEach(el => el.classList.remove('drag-over'));
  draggedId = null;
}

function onDragOver(e) {
  e.preventDefault();
  const targetId = parseInt(e.currentTarget.dataset.id);
  if (targetId === draggedId) return;
  document.querySelectorAll('.s-item.drag-over').forEach(el => el.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  const targetId = parseInt(e.currentTarget.dataset.id);
  if (targetId === draggedId || draggedId === null) return;
  const draggedItem = workingItems.find(i => i.id === draggedId);
  const targetItem  = workingItems.find(i => i.id === targetId);
  if (!draggedItem || !targetItem) return;
  const getStore = i => STORES.includes(i.store) ? i.store : 'Others';
  if (getStore(draggedItem) !== getStore(targetItem)) return;
  const fromIdx = workingItems.indexOf(draggedItem);
  const toIdx   = workingItems.indexOf(targetItem);
  workingItems.splice(fromIdx, 1);
  workingItems.splice(toIdx, 0, draggedItem);
  workingItems.forEach((item, idx) => { item.sort_order = idx; });
  renderWorking();
  dbUpdateSortOrders(workingItems);
}

document.addEventListener('DOMContentLoaded', async () => {
  [workingItems, pastItems] = await Promise.all([dbLoadWorkingItems(), dbLoadPastItems()]);
  if (workingItems.length || pastItems.length) {
    const maxId = Math.max(...workingItems.map(i => i.id), ...pastItems.map(i => i.id), nextId - 1);
    nextId = maxId + 1;
  }
  render();

  const pastPanel = document.getElementById('past-panel');
  pastPanel.addEventListener('dragover', e => {
    if (draggedId === null) return;
    e.preventDefault();
    pastPanel.classList.add('drop-target');
  });
  pastPanel.addEventListener('dragleave', e => {
    if (!pastPanel.contains(e.relatedTarget)) pastPanel.classList.remove('drop-target');
  });
  pastPanel.addEventListener('drop', e => {
    e.preventDefault();
    pastPanel.classList.remove('drop-target');
    if (draggedId === null) return;
    moveToArchive(draggedId);
    draggedId = null;
  });
});
