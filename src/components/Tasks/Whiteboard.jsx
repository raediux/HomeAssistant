import { useEffect, useRef, useState, useCallback } from 'react';
import { IconEraser, IconArrowBackUp } from '@tabler/icons-react';
import { dbLoadWhiteboard, dbSaveWhiteboard } from '../../db.js';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import ColorPicker from './ColorPicker.jsx';
import s from './Tasks.module.css';

const COLORS = ['#e8eaf0', '#4a8fd4', '#c46090', '#c9a838', '#64c882', '#e05555'];
const SIZES  = [{ stroke: 1, px: 1.5 }, { stroke: 2, px: 3 }, { stroke: 4, px: 6 }];
const BG     = '#16161a';

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

  function pushHistory() {
    const dataUrl = canvasRef.current.toDataURL('image/png');
    history.current.push(dataUrl);
    if (history.current.length > HISTORY_LIMIT) history.current.shift();
    setCanUndo(true);
  }

  function undo() {
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
  }

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      if (dataUrl.length > 1_400_000) return;
      dbSaveWhiteboard(dataUrl);
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
    if (eraser) ctx.lineWidth = SIZES[size].px * 6;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function endDraw(e) {
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
  }, []);

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
          className={`${s.eraserBtn} ${eraser ? s.eraserBtnActive : ''}`}
          onClick={() => setEraser(e => !e)}
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
