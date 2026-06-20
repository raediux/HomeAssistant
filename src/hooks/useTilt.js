import { useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';

export function useTilt(maxDeg = 7) {
  const ref = useRef(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-maxDeg, maxDeg]), { stiffness: 300, damping: 25 });
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [maxDeg, -maxDeg]), { stiffness: 300, damping: 25 });

  function onMouseMove(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    rawX.set((e.clientX - r.left) / r.width - 0.5);
    rawY.set((e.clientY - r.top) / r.height - 0.5);
  }

  function onMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return { ref, rotateX, rotateY, onMouseMove, onMouseLeave };
}
