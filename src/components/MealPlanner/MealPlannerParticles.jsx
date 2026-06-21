import { useEffect, useRef } from 'react';

const EMOJIS = ['🍕','🍜','🥗','🍣','🌮','🥘','🍝','🍛','🥩','🍱','🥞','🍔'];

export default function MealPlannerParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;
    canvas.width  = w;
    canvas.height = h;

    const particles = Array.from({ length: 18 }, () => ({
      x:     Math.random(),
      y:     Math.random(),
      vx:    (Math.random() - 0.5) * 0.00012,
      vy:    -0.00008 - Math.random() * 0.00008,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      size:  14 + Math.random() * 10,
      alpha: 0.08 + Math.random() * 0.10,
      rot:   Math.random() * Math.PI * 2,
      dRot:  (Math.random() - 0.5) * 0.003,
    }));

    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      w = r.width; h = r.height;
      canvas.width  = w;
      canvas.height = h;
    });
    ro.observe(parent);

    function tick() {
      if (document.hidden || w === 0 || h === 0) { animId = requestAnimationFrame(tick); return; }
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.rot += p.dRot;
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05)  p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.font = `${p.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(p.x * w, p.y * h);
        ctx.rotate(p.rot);
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
      }
      animId = requestAnimationFrame(tick);
    }

    tick();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, borderRadius: 'inherit' }}
    />
  );
}
