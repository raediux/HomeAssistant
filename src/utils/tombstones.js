// Short-lived record of ids this device just deleted.
//
// Deletes are written to the DB immediately, but another device may still hold
// a stale copy of the row. If it upserts that row (toggling a checkbox, saving
// a reorder) the delete is undone and the realtime INSERT pushes the item back
// onto our list. Ignoring events for recently-deleted ids closes that window.
const TTL_MS = 30_000;
const graves = new Map(); // id -> expiry timestamp

export function markDeleted(id) {
  graves.set(String(id), Date.now() + TTL_MS);
}

export function unmarkDeleted(id) {
  graves.delete(String(id));
}

export function isDeleted(id) {
  const until = graves.get(String(id));
  if (until === undefined) return false;
  if (Date.now() > until) { graves.delete(String(id)); return false; }
  return true;
}
