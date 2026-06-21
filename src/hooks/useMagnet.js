import { useRef } from 'react';
import { useSpring } from 'framer-motion';

export function useMagnet(strength = 0.38, radius = 90) {
  const ref = useRef(null);
  const x = useSpring(0, { stiffness: 260, damping: 18 });
  const y = useSpring(0, { stiffness: 260, damping: 18 });

  function onMouseMove(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width  / 2);
    const dy = e.clientY - (r.top  + r.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius) {
      x.set(dx * strength);
      y.set(dy * strength);
    }
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return { ref, x, y, onMouseMove, onMouseLeave };
}
