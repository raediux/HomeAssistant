export function cn(...args) {
  return args.filter(Boolean).join(' ');
}

export function memberSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '_');
}

// Local-time YYYY-MM-DD. Never use toISOString() for date keys — it's UTC,
// which is yesterday's date before ~10-11am in Sydney.
export function dateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayStr() {
  return dateStr(new Date());
}

// Collision-safe client-side id for bigint PK columns: microsecond-scale
// timestamp + random suffix. Two devices only collide on same-ms + same-rand.
export function newId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
