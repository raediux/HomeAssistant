import { useCallback, useEffect, useRef, useState } from 'react';
import { IconEraser, IconArrowBackUp, IconBucketDroplet } from '@tabler/icons-react';
import { dbLoadWhiteboard, dbSaveWhiteboard } from '../../db.js';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import ColorPicker from './ColorPicker.jsx';
import s from './Tasks.module.css';

const COLORS = ['#e8eaf0', '#4a8fd4', '#c46090', '#c9a838', '#64c882', '#e05555'];
const SIZES  = [{ stroke: 1, px: 1.5 }, { stroke: 2, px: 3 }, { stroke: 4, px: 6 }];
const BG     = '#16161a';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function matches(data, i, target, tol) {
  return (
    Math.abs(data[i]     - target[0]) <= tol &&
    Math.abs(data[i + 1] - target[1]) <= tol &&
    Math.abs(data[i + 2] - target[2]) <= tol &&
    Math.abs(data[i + 3] - target[3]) <= tol
  );
}

export default function Whiteboard() {
  const { features } = useHousehold();
  if (!features?.includes('whiteboard')) return null;
  return <WhiteboardCanvas />;
}

const HISTORY_LIMIT = 20;

function WhiteboardCanvas() {
  const canvasRef   = useRef(null);
  const drawing     = useRef(false);
  const saveTimer   = useRef(null);
  const history     = useRef([]);
  const [color, setColor]   = useState(COLORS[0]);
  const [size, setSize]     = useState(0);
  const [eraser, setEraser] = useState(false);
  const [fill, setFill]     = useState(false);
  const [canUndo, setCanUndo] = useState(false);

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
      if (!dataUrl) {
        history.current = [canvas.toDataURL('image/png')];
        return;
      }
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        history.current = [canvas.toDataURL('image/png')];
      };
      img.src = dataUrl;
    });
    return () => ro.disconnect();
  }, []);

  function pushHistory() {
    const dataUrl = canvasRef.current.toDataURL('image/png');
    history.current.push(dataUrl);
    if (history.current.length > HISTORY_LIMIT) history.current.shift();
    setCanUndo(true);
  }

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      if (dataUrl.length > 1_400_000) return;
      dbSaveWhiteboard(dataUrl);
    }, 2000);
  }, []);

  const undo = useCallback(() => {
    if (!history.current.length) return;
    history.current.pop();
    setCanUndo(history.current.length > 0);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const prev = history.current[history.current.length - 1];
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (prev) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = prev;
    }
    scheduleSave();
  }, [scheduleSave]);

  function getPos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  function floodFill(px, py) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const x0 = Math.floor(px), y0 = Math.floor(py);
    if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;

    const img = ctx.getImageData(0, 0, W, H);
    const data = img.data;
    const start = (y0 * W + x0) * 4;
    const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
    const [fr, fg, fb] = hexToRgb(color);
    const tol = 32;

    // Already the fill colour → nothing to do.
    if (matches(target, 0, [fr, fg, fb, 255], 0)) return;

    const stack = [[x0, y0]];
    while (stack.length) {
      const [x, y] = stack.pop();
      const i = (y * W + x) * 4;
      if (!matches(data, i, target, tol)) continue;
      data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = 255;
      if (x > 0)     stack.push([x - 1, y]);
      if (x < W - 1) stack.push([x + 1, y]);
      if (y > 0)     stack.push([x, y - 1]);
      if (y < H - 1) stack.push([x, y + 1]);
    }

    ctx.putImageData(img, 0, 0);
    pushHistory();
    scheduleSave();
  }

  function startDraw(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    if (fill) {
      const { x, y } = getPos(e);
      floodFill(x, y);
      return;
    }
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
    if (eraser) ctx.lineWidth = SIZES[size].px * 6;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    pushHistory();
    scheduleSave();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    pushHistory();
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    scheduleSave();
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  return (
    <div className={s.boardWrap}>
      <div className={s.boardBar}>
        {COLORS.map(c => (
          <div
            key={c}
            className={`${s.colorBtn} ${color === c && !eraser ? s.colorBtnActive : ''}`}
            style={{ background: c, width: 14, height: 14 }}
            onClick={() => { setColor(c); setEraser(false); }}
          />
        ))}
        <ColorPicker color={color} onChange={c => { setColor(c); setEraser(false); }} />
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        {SIZES.map((sz, i) => (
          <button
            key={i}
            className={`${s.sizeBtn} ${size === i ? s.sizeBtnActive : ''}`}
            onClick={() => setSize(i)}
            title={['Thin','Medium','Thick'][i]}
          >
            <svg width="16" height="12" viewBox="0 0 20 14" style={{ display: 'block' }}>
              <line x1="3" y1="7" x2="17" y2="7" stroke="currentColor" strokeWidth={sz.stroke} strokeLinecap="round" />
            </svg>
          </button>
        ))}
        <button
          className={`${s.eraserBtn} ${fill ? s.eraserBtnActive : ''}`}
          onClick={() => { setFill(f => !f); setEraser(false); }}
          title="Fill"
        >
          <IconBucketDroplet size={12} />
        </button>
        <button
          className={`${s.eraserBtn} ${eraser ? s.eraserBtnActive : ''}`}
          onClick={() => { setEraser(e => !e); setFill(false); }}
          title="Eraser"
        >
          <IconEraser size={12} />
        </button>
        <span className={s.boardSep} />
        <span
          onClick={canUndo ? undo : undefined}
          title="Undo (Ctrl+Z)"
          style={{ opacity: canUndo ? 1 : 0.5, cursor: canUndo ? 'pointer' : 'default', display: 'flex', alignItems: 'center', color: 'var(--text2)', flexShrink: 0 }}
        >
          <IconArrowBackUp size={12} />
        </span>
        <button className={s.clearBtn} onClick={clearCanvas}>Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        className={s.boardCanvas}
        style={{ flex: 1, minHeight: 0 }}
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
