import { supabase as db } from './supabase.js';

// ── Household ─────────────────────────────────────────────────
let _householdId = null;

export async function getMyHouseholdId() {
  if (_householdId) return _householdId;
  const { data: { session } } = await db.auth.getSession();
  if (!session) return null;
  const { data } = await db.from('household_members')
    .select('household_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  _householdId = data?.household_id ?? null;
  return _householdId;
}

export function clearHouseholdId() { _householdId = null; }

export async function dbLoadMembers() {
  const { data, error } = await db.from('household_members')
    .select('id, name, role, color, user_id, shares_meals').order('sort_order').order('created_at');
  if (error) { console.error('dbLoadMembers:', error); return []; }
  return data || [];
}

export async function dbSaveMemberColor(memberId, color) {
  const { error } = await db.from('household_members').update({ color }).eq('id', memberId);
  if (error) console.error('dbSaveMemberColor:', error);
}

export async function dbSetMemberSharesMeals(memberId, value) {
  const { error } = await db.from('household_members').update({ shares_meals: value }).eq('id', memberId);
  if (error) console.error('dbSetMemberSharesMeals:', error);
}

export async function dbLoadTier(householdId) {
  const { data, error } = await db.from('subscriptions').select('tier, features').eq('household_id', householdId).maybeSingle();
  if (error) {
    // Transient/RLS failure — signal caller to preserve previously known values
    // rather than silently blanking tier/features (which hides feature-gated UI).
    console.warn('dbLoadTier failed:', error.message);
    return null;
  }
  return { tier: data?.tier || 'free', features: data?.features || [] };
}

// ── Tasks ─────────────────────────────────────────────────────
export async function dbLoadTasks() {
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

export async function dbSaveTask(task) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('tasks').upsert({
    id: task.id, person: task.person, frequency: task.frequency,
    title: task.title, due_date: task.dueDate || null, dow: task.dow ?? null,
    done: task.done, last_done_date: task.lastDoneDate || null, household_id: hid,
  }, { onConflict: 'id' });
  if (error) console.error('dbSaveTask:', error);
}

export async function dbDeleteTask(id) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('tasks').delete().eq('id', id).eq('household_id', hid);
  if (error) console.error('dbDeleteTask:', error);
}

// ── Calendar badges ───────────────────────────────────────────
export async function dbLoadBadges() {
  const { data, error } = await db.from('calendar_badges').select('*').order('id');
  if (error) { console.error('dbLoadBadges:', error); return []; }
  return data.map(row => ({ id: row.id, date: row.date, label: row.label, color: row.color }));
}

export async function dbSaveBadge(badge) {
  const hid = await getMyHouseholdId();
  const { data, error } = await db.from('calendar_badges').insert(
    { date: badge.date, label: badge.label, color: badge.color, household_id: hid }
  ).select().single();
  if (error) { console.error('dbSaveBadge:', error); return null; }
  return data.id;
}

export async function dbDeleteBadge(id) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('calendar_badges').delete().eq('id', id).eq('household_id', hid);
  if (error) console.error('dbDeleteBadge:', error);
}

// ── Shopping — weekly auto-clear ─────────────────────────────
export async function dbGetLastShoppingClear() {
  const hid = await getMyHouseholdId();
  if (!hid) return null;
  const { data } = await db.from('households').select('last_shopping_clear').eq('id', hid).maybeSingle();
  return data?.last_shopping_clear ?? null;
}

export async function dbSetLastShoppingClear(dateStr) {
  const hid = await getMyHouseholdId();
  if (!hid) return;
  await db.from('households').update({ last_shopping_clear: dateStr }).eq('id', hid);
}

// ── Shopping — working list ───────────────────────────────────
export async function dbLoadWorkingItems() {
  const { data, error } = await db.from('shopping_working').select('*').order('sort_order').order('id');
  if (error) { console.error('dbLoadWorkingItems:', error); return []; }
  return data.map(row => ({
    id: row.id, name: row.name, qty: row.qty,
    store: row.store, got: row.got, sort_order: row.sort_order ?? 0,
  }));
}

export async function dbSaveWorkingItem(item) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('shopping_working').upsert({
    id: item.id, name: item.name, qty: item.qty || null,
    store: item.store || null, got: item.got, sort_order: item.sort_order ?? 0,
    household_id: hid,
  }, { onConflict: 'id' });
  if (error) console.error('dbSaveWorkingItem:', error);
}

export async function dbUpdateSortOrders(items) {
  const hid = await getMyHouseholdId();
  const updates = items.map((item, idx) => ({
    id: item.id, name: item.name, qty: item.qty || null,
    store: item.store || null, got: item.got, sort_order: idx, household_id: hid,
  }));
  const { error } = await db.from('shopping_working').upsert(updates, { onConflict: 'id' });
  if (error) console.error('dbUpdateSortOrders:', error);
}

export async function dbDeleteWorkingItem(id) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('shopping_working').delete().eq('id', id).eq('household_id', hid);
  if (error) console.error('dbDeleteWorkingItem:', error);
}

// ── Shopping — past purchases ─────────────────────────────────
export async function dbLoadPastItems() {
  const { data, error } = await db.from('shopping_past').select('*').order('times', { ascending: false });
  if (error) { console.error('dbLoadPastItems:', error); return []; }
  return data.map(row => ({
    id: row.id, name: row.name, store: row.store, times: row.times, category: row.category,
  }));
}

export async function dbSavePastItem(item) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('shopping_past').upsert({
    id: item.id, name: item.name, store: item.store || null,
    times: item.times, category: item.category || 'Other', household_id: hid,
  }, { onConflict: 'id' });
  if (error) console.error('dbSavePastItem:', error);
}

export async function dbDeletePastItem(id) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('shopping_past').delete().eq('id', id).eq('household_id', hid);
  if (error) console.error('dbDeletePastItem:', error);
}

// ── Meal plans ────────────────────────────────────────────────
export async function dbLoadMeals() {
  const { data, error } = await db.from('meal_plans').select('*');
  if (error) { console.error('dbLoadMeals:', error); return []; }
  return data;
}

export async function dbSaveMeal(date, person, slot, meal) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('meal_plans').upsert(
    { date, person, slot, meal, household_id: hid },
    { onConflict: 'household_id,date,person,slot' }
  );
  if (error) console.error('dbSaveMeal:', error);
}

export async function dbDeleteMeal(date, person, slot) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('meal_plans')
    .delete().eq('date', date).eq('person', person).eq('slot', slot).eq('household_id', hid);
  if (error) console.error('dbDeleteMeal:', error);
}

export async function dbLoadWhiteboard() {
  const hid = await getMyHouseholdId();
  const { data, error } = await db.from('whiteboard').select('data').eq('household_id', hid).maybeSingle();
  if (error) { console.error('dbLoadWhiteboard:', error); return null; }
  return data?.data ?? null;
}

export async function dbSaveWhiteboard(dataUrl) {
  const hid = await getMyHouseholdId();
  const { error } = await db.from('whiteboard').upsert(
    { household_id: hid, data: dataUrl, updated_at: new Date().toISOString() },
    { onConflict: 'household_id' }
  );
  if (error) console.error('dbSaveWhiteboard:', error);
}
