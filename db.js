// ── Supabase client ───────────────────────────────────────────
// Loaded after config.js which defines SUPABASE_URL and SUPABASE_ANON_KEY.
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Tasks ─────────────────────────────────────────────────────
async function dbLoadTasks() {
  const { data, error } = await db.from('tasks').select('*').order('id');
  if (error) { console.error('dbLoadTasks:', error); return []; }
  return data.map(row => ({
    id:           row.id,
    person:       row.person,
    frequency:    row.frequency,
    title:        row.title,
    dueDate:      row.due_date,
    dow:          row.dow,
    done:         row.done,
    lastDoneDate: row.last_done_date || null,
  }));
}

async function dbSaveTask(task) {
  const row = {
    id:             task.id,
    person:         task.person,
    frequency:      task.frequency,
    title:          task.title,
    due_date:       task.dueDate      || null,
    dow:            task.dow          ?? null,
    done:           task.done,
    last_done_date: task.lastDoneDate || null,
  };
  const { error } = await db.from('tasks').upsert(row, { onConflict: 'id' });
  if (error) console.error('dbSaveTask:', error);
}

async function dbDeleteTask(id) {
  const { error } = await db.from('tasks').delete().eq('id', id);
  if (error) console.error('dbDeleteTask:', error);
}

// ── Calendar badges ───────────────────────────────────────────
async function dbLoadBadges() {
  const { data, error } = await db.from('calendar_badges').select('*').order('id');
  if (error) { console.error('dbLoadBadges:', error); return []; }
  return data.map(row => ({ id: row.id, date: row.date, label: row.label, color: row.color }));
}

async function dbSaveBadge(badge) {
  const { data, error } = await db.from('calendar_badges').insert(
    { date: badge.date, label: badge.label, color: badge.color }
  ).select().single();
  if (error) { console.error('dbSaveBadge:', error); return null; }
  return data.id;
}

async function dbDeleteBadge(id) {
  const { error } = await db.from('calendar_badges').delete().eq('id', id);
  if (error) console.error('dbDeleteBadge:', error);
}

// ── Shopping — working list ───────────────────────────────────
async function dbLoadWorkingItems() {
  const { data, error } = await db.from('shopping_working').select('*').order('id');
  if (error) { console.error('dbLoadWorkingItems:', error); return []; }
  return data.map(row => ({
    id:       row.id,
    name:     row.name,
    qty:      row.qty,
    store:    row.store,
    got:      row.got,
    category: row.category,
  }));
}

async function dbSaveWorkingItem(item) {
  const { error } = await db.from('shopping_working').upsert({
    id: item.id, name: item.name, qty: item.qty || null,
    store: item.store || null, got: item.got, category: item.category,
  }, { onConflict: 'id' });
  if (error) console.error('dbSaveWorkingItem:', error);
}

async function dbDeleteWorkingItem(id) {
  const { error } = await db.from('shopping_working').delete().eq('id', id);
  if (error) console.error('dbDeleteWorkingItem:', error);
}

// ── Shopping — past purchases ─────────────────────────────────
async function dbLoadPastItems() {
  const { data, error } = await db.from('shopping_past').select('*').order('times', { ascending: false });
  if (error) { console.error('dbLoadPastItems:', error); return []; }
  return data.map(row => ({
    id:       row.id,
    name:     row.name,
    store:    row.store,
    times:    row.times,
    category: row.category,
  }));
}

async function dbSavePastItem(item) {
  const { error } = await db.from('shopping_past').upsert({
    id: item.id, name: item.name, store: item.store || null,
    times: item.times, category: item.category || 'Other',
  }, { onConflict: 'id' });
  if (error) console.error('dbSavePastItem:', error);
}

async function dbDeletePastItem(id) {
  const { error } = await db.from('shopping_past').delete().eq('id', id);
  if (error) console.error('dbDeletePastItem:', error);
}

// ── Meal plans ────────────────────────────────────────────────
async function dbLoadMeals() {
  const { data, error } = await db.from('meal_plans').select('*');
  if (error) { console.error('dbLoadMeals:', error); return []; }
  return data;
}

async function dbSaveMeal(date, person, slot, meal) {
  const { error } = await db.from('meal_plans').upsert(
    { date, person, slot, meal }, { onConflict: 'date,person,slot' }
  );
  if (error) console.error('dbSaveMeal:', error);
}

async function dbDeleteMeal(date, person, slot) {
  const { error } = await db.from('meal_plans')
    .delete().eq('date', date).eq('person', person).eq('slot', slot);
  if (error) console.error('dbDeleteMeal:', error);
}
