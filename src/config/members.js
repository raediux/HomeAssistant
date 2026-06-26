// Canonical per-member accent palette. Keyed by name (case-insensitive match).
// Used by HouseholdContext to enrich DB members and by any component that needs
// glow/tint/shadow variants without re-deriving them from a hex string.
export const MEMBER_ACCENTS = [
  { name: 'Ray',     color: '#4a8fd4', glow: 'rgba(74,143,212,0.22)',  tint: 'rgba(74,143,212,0.05)',  shadow: 'rgba(74,143,212,0.18)' },
  { name: 'Jazelle', color: '#c46090', glow: 'rgba(196,96,144,0.15)',  tint: 'rgba(196,96,144,0.04)',  shadow: 'rgba(196,96,144,0.14)' },
  { name: 'Linus',   color: '#c9a838', glow: 'rgba(201,168,56,0.11)',  tint: 'rgba(201,168,56,0.04)',  shadow: 'rgba(201,168,56,0.12)' },
  { name: 'Guest',   color: '#64c882', glow: 'rgba(100,200,130,0.13)', tint: 'rgba(100,200,130,0.04)', shadow: 'rgba(100,200,130,0.12)' },
];

const FALLBACK = { color: '#64c882', glow: 'rgba(100,200,130,0.13)', tint: 'rgba(100,200,130,0.04)', shadow: 'rgba(100,200,130,0.12)' };

export function memberAccent(nameOrIndex) {
  if (typeof nameOrIndex === 'number') return MEMBER_ACCENTS[nameOrIndex] ?? FALLBACK;
  const lower = nameOrIndex?.toLowerCase();
  return MEMBER_ACCENTS.find(m => m.name.toLowerCase() === lower) ?? FALLBACK;
}
