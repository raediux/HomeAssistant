import { useEffect } from 'react';

// `ref` may be a single ref or an array — pass several when part of the UI is
// portalled outside the main element (e.g. a floating popover).
// Clicks inside any [data-popover] element are ignored, so a portalled popover
// opened from inside a panel doesn't count as "outside" that panel.
export function useClickOutside(ref, onClose) {
  useEffect(() => {
    const refs = Array.isArray(ref) ? ref : [ref];
    function handle(e) {
      if (e.target.closest?.('[data-popover]')) return;
      const els = refs.map(r => r.current).filter(Boolean);
      if (els.length && !els.some(el => el.contains(e.target))) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, onClose]);
}
