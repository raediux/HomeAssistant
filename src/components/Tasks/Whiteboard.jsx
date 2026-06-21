import { useEffect, useRef, useState, useCallback } from 'react';
import { dbLoadWhiteboard, dbSaveWhiteboard } from '../../db.js';
import s from './Tasks.module.css';

const COLORS = ['#e8eaf0', '#4a8fd4', '#c46090', '#c9a838', '#64c882', '#e05555'];
const SIZES  = [{ label: 'S', px: 3 }, { label: 'M', px: 7 }, { label: 'L', px: 14 }];
const BG     = '#16161a';

export default function Whiteboard() {
  const canvasRef   = useRef(null);
  const drawing     = useRef(false);
  const saveTimer   = useRef(null);
  const [color, setColor]   = useState(COLORS[0]);
  const [size, setSize]     = useState(1);
  const [eraser, setEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    function resize() {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(data, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    dbLoadWhiteboard().then(dataUrl => {
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = dataUrl;
    });
    return () => ro.disconnect();
  }, []);

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dbSaveWhiteboard(canvasRef.current.toDataURL('image/png'));
    }, 2000);
  }, []);

  function getPos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e);
    ctx.lineWidth   = SIZES[size].px;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = eraser ? BG : color;
    if (eraser) ctx.lineWidth = SIZES[size].px * 4;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function endDraw(e) {
    if (!drawing.current) return;
    drawing.current = false;
    scheduleSave();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    scheduleSave();
  }

  return (
    <div className={s.boardWrap}>
      <div className={s.boardBar}>
        <span className={s.boardTitle}>Board</span>
        {COLORS.map(c => (
          <div
            key={c}
            className={`${s.colorBtn} ${color === c && !eraser ? s.colorBtnActive : ''}`}
            style={{ background: c }}
            onClick={() => { setColor(c); setEraser(false); }}
          />
        ))}
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        {SIZES.map((sz, i) => (
          <button
            key={sz.label}
            className={`${s.sizeBtn} ${size === i ? s.sizeBtnActive : ''}`}
            onClick={() => setSize(i)}
          >{sz.label}</button>
        ))}
        <span className={s.boardSep} />
        <button
          className={`${s.eraserBtn} ${eraser ? s.eraserBtnActive : ''}`}
          onClick={() => setEraser(e => !e)}
        >Eraser</button>
        <button className={s.clearBtn} onClick={clearCanvas}>Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        className={s.boardCanvas}
        style={{ height: 220 }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
    </div>
  );
}
