export function cn(...args) {
  return args.filter(Boolean).join(' ');
}

export function memberSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '_');
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function dateStr(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
