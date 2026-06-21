import { useEffect, useRef } from 'react';

export default function MemberParticles({ color }) {
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

    const particles = Array.from({ length: 40 }, () => ({
      x:      Math.random(),
      y:      Math.random(),
      vx:     (Math.random() - 0.5) * 0.00025,
      vy:     (Math.random() - 0.5) * 0.00025,
      r:      Math.random() * 0.9 + 0.4,
      alpha:  Math.random() * 0.35 + 0.18,
      dAlpha: (Math.random() - 0.5) * 0.0015,
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
        p.x += p.vx;
        p.y += p.vy;
        p.alpha += p.dAlpha;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        if (p.alpha < 0.12 || p.alpha > 0.55) p.dAlpha *= -1;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(tick);
    }

    tick();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: -1, borderRadius: 'inherit' }}
    />
  );
}
