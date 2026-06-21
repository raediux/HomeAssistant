import { useEffect, useRef } from 'react';

const EMOJIS = ['🍕','🍜','🥗','🍣','🌮','🥘','🍝','🍛','🥩','🍱','🥞','🍔'];

export default function MealPlannerParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx;
    try { ctx = canvas.getContext('2d'); } catch { return; }
    let animId;

    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    let w = rect.width || 1;
    let h = rect.height || 1;
    canvas.width  = w;
    canvas.height = h;

    // Pre-render each emoji to an offscreen canvas to avoid per-frame text cost
    const SIZE = 22;
    const stamps = EMOJIS.map(em => {
      const oc = document.createElement('canvas');
      oc.width = SIZE * 2; oc.height = SIZE * 2;
      const ox = oc.getContext('2d');
      ox.font = `${SIZE}px serif`;
      ox.textAlign = 'center';
      ox.textBaseline = 'middle';
      ox.fillText(em, SIZE, SIZE);
      return oc;
    });

    const particles = Array.from({ length: 16 }, (_, i) => ({
      x:     Math.random(),
      y:     Math.random(),
      vx:    (Math.random() - 0.5) * 0.00010,
      vy:    -0.00006 - Math.random() * 0.00007,
      stamp: stamps[i % stamps.length],
      alpha: 0.10 + Math.random() * 0.12,
      rot:   Math.random() * Math.PI * 2,
      dRot:  (Math.random() - 0.5) * 0.002,
    }));

    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      w = r.width || 1; h = r.height || 1;
      canvas.width = w; canvas.height = h;
    });
    ro.observe(parent);

    function tick() {
      if (document.hidden || w <= 1 || h <= 1) { animId = requestAnimationFrame(tick); return; }
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
        ctx.translate(p.x * w, p.y * h);
        ctx.rotate(p.rot);
        ctx.drawImage(p.stamp, -SIZE, -SIZE, SIZE * 2, SIZE * 2);
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
