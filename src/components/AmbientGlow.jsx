import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function AmbientGlow() {
  const mouseX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
  const mouseY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 });
  const x = useTransform(springX, v => v - 300);
  const y = useTransform(springY, v => v - 300);

  useEffect(() => {
    function onMove(e) { mouseX.set(e.clientX); mouseY.set(e.clientY); }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <motion.div
      style={{
        position: 'fixed', top: 0, left: 0,
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(74,143,212,0.07) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0, x, y,
      }}
    />
  );
}
