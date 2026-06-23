import { useEffect, useRef, useState } from 'react';
import { IconPalette } from '@tabler/icons-react';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import s from './ColorPicker.module.css';

function hsvToRgb(h, sat, v) {
  const c = v * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r=0,g=0,b=0;
  if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}
  else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
  return [Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)];
}
function rgbToHex(r,g,b){return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}
function hexToRgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
function rgbToHsv(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0,sv=max===0?0:d/max,v=max;
  if(d){if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}
  return [h*360,sv,v];
}

export default function ColorPicker({ color, onChange }) {
  const [open, setOpen]       = useState(false);
  const [hsv, setHsv]         = useState(() => { const [r,g,b]=hexToRgb(color); return rgbToHsv(r,g,b); });
  const [hexInput, setHexInput] = useState(color);
  const wrapRef  = useRef(null);
  const svRef    = useRef(null);
  const hueRef   = useRef(null);
  const dragging = useRef(null);

  useClickOutside(wrapRef, () => setOpen(false));

  useEffect(() => {
    setHexInput(color);
    const [r,g,b] = hexToRgb(color);
    setHsv(rgbToHsv(r,g,b));
  }, [color]);

  useEffect(() => {
    if (!open) return;
    drawSV(hsv);
    drawHue(hsv);
  }, [open, hsv[0], hsv[1], hsv[2]]);

  function drawSV([h, sat, v]) {
    const canvas = svRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const {width: w, height: ht} = canvas;
    const gH = ctx.createLinearGradient(0,0,w,0);
    gH.addColorStop(0,'#fff'); gH.addColorStop(1,`hsl(${h},100%,50%)`);
    ctx.fillStyle = gH; ctx.fillRect(0,0,w,ht);
    const gV = ctx.createLinearGradient(0,0,0,ht);
    gV.addColorStop(0,'transparent'); gV.addColorStop(1,'#000');
    ctx.fillStyle = gV; ctx.fillRect(0,0,w,ht);
    const cx = sat*w, cy = (1-v)*ht;
    ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2);
    ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
  }

  function drawHue([h]) {
    const canvas = hueRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const {width: w, height: ht} = canvas;
    const grad = ctx.createLinearGradient(0,0,0,ht);
    [0,60,120,180,240,300,360].forEach(d=>grad.addColorStop(d/360,`hsl(${d},100%,50%)`));
    ctx.fillStyle=grad; ctx.fillRect(0,0,w,ht);
    const y = (h/360)*ht;
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,y-2,w,4);
    ctx.fillStyle='#fff'; ctx.fillRect(1,y-1,w-2,2);
  }

  function pickSV(e) {
    const canvas = svRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const sat = Math.max(0,Math.min(1,(src.clientX-rect.left)/rect.width));
    const v   = Math.max(0,Math.min(1,1-(src.clientY-rect.top)/rect.height));
    commit([hsv[0], sat, v]);
  }

  function pickHue(e) {
    const canvas = hueRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const h = Math.max(0,Math.min(360,((src.clientY-rect.top)/rect.height)*360));
    commit([h, hsv[1], hsv[2]]);
  }

  function commit(newHsv) {
    setHsv(newHsv);
    const [r,g,b] = hsvToRgb(...newHsv);
    const hex = rgbToHex(r,g,b);
    setHexInput(hex);
    onChange(hex);
  }

  function startDrag(type, firstEvent) {
    dragging.current = type;
    if (type === 'sv') pickSV(firstEvent); else pickHue(firstEvent);
    function onMove(e) { if(dragging.current==='sv') pickSV(e); else pickHue(e); }
    function onUp() { dragging.current=null; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onHexInput(e) {
    const val = e.target.value;
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      const [r,g,b] = hexToRgb(val);
      commit(rgbToHsv(r,g,b));
    }
  }

  const [r,g,b] = hsvToRgb(...hsv);

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <div className={s.trigger} onClick={() => setOpen(o => !o)} title="Custom colour">
        <IconPalette size={15} />
      </div>
      {open && (
        <div className={s.popover}>
          <div className={s.canvases}>
            <canvas ref={svRef} width={180} height={160} className={s.svCanvas}
              onMouseDown={e => startDrag('sv', e)} />
            <canvas ref={hueRef} width={14} height={160} className={s.hueCanvas}
              onMouseDown={e => startDrag('hue', e)} />
          </div>
          <div className={s.footer}>
            <div className={s.swatch} style={{ background: hexInput }} />
            <div className={s.fields}>
              <div className={s.field}>
                <span className={s.label}>Hex</span>
                <input value={hexInput} onChange={onHexInput} className={s.hexInput} maxLength={7} spellCheck={false} />
              </div>
              <div className={s.field}><span className={s.label}>R</span><span className={s.val}>{r}</span></div>
              <div className={s.field}><span className={s.label}>G</span><span className={s.val}>{g}</span></div>
              <div className={s.field}><span className={s.label}>B</span><span className={s.val}>{b}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
