import { useEffect, useRef, useState } from 'react';
import {
  IconSun, IconMoon, IconCloud,
  IconCloudRain, IconCloudStorm, IconCloudSnow, IconCloudFog,
  IconThermometer, IconDroplet, IconWind, IconChevronRight,
} from '@tabler/icons-react';
import { WEATHER_KEY, WEATHER_LAT, WEATHER_LON } from '../../supabase.js';

const OWM_BASE    = 'https://api.openweathermap.org/data/2.5';
const WX_CACHE_KEY = 'ha_weather';
const WX_TTL      = 30 * 60 * 1000;

const ICON_MAP = {
  '01d': IconSun,        '01n': IconMoon,
  '02d': IconCloud,      '02n': IconCloud,
  '03d': IconCloud,      '03n': IconCloud,
  '04d': IconCloud,      '04n': IconCloud,
  '09d': IconCloudRain,  '09n': IconCloudRain,
  '10d': IconCloudRain,  '10n': IconCloudRain,
  '11d': IconCloudStorm, '11n': IconCloudStorm,
  '13d': IconCloudSnow,  '13n': IconCloudSnow,
  '50d': IconCloudFog,   '50n': IconCloudFog,
};

const COLOR_MAP = {
  '01': '#f4c842', '02': '#e8be50',
  '03': '#7a9ab0', '04': '#6a8a9e',
  '09': '#5b9fd4', '10': '#5b9fd4',
  '11': '#9b7fd4', '13': '#a8d4f4', '50': '#8aabbb',
};

function wxIcon(code) { return ICON_MAP[code] || ICON_MAP[code.slice(0,2)+'d'] || IconCloud; }
function wxColor(code) { return COLOR_MAP[code.slice(0,2)] || 'var(--text2)'; }
function wxTempColor(t) { return t < 10 ? '#6db0e0' : t > 20 ? '#e8b04a' : 'var(--text)'; }
function fmtHour(dt) {
  const h = new Date(dt * 1000).getHours();
  return h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
}

function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(WX_CACHE_KEY) || 'null');
    return c && (Date.now() - c.ts < WX_TTL) ? c : null;
  } catch { return null; }
}

async function fetchWeather() {
  const [cur, fore] = await Promise.all([
    fetch(`${OWM_BASE}/weather?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&units=metric&appid=${WEATHER_KEY}`).then(r => r.json()),
    fetch(`${OWM_BASE}/forecast?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&units=metric&cnt=40&appid=${WEATHER_KEY}`).then(r => r.json()),
  ]);
  if (cur.cod && cur.cod !== 200)    throw new Error(cur.message);
  if (fore.cod && fore.cod !== '200') throw new Error(fore.message);

  const now = Date.now() / 1000;
  const hours = fore.list.filter(i => i.dt > now).slice(0, 8).map(i => ({
    dt: i.dt,
    icon: i.weather[0].icon,
    temp: Math.round(i.main.temp),
  }));

  const data = { cur, hours, ts: Date.now() };
  try { localStorage.setItem(WX_CACHE_KEY, JSON.stringify(data)); } catch {}
  return data;
}

// slot dimensions
const SLOT_W = 52;
const SLOT_GAP = 8;
const VISIBLE = 5;
const STRIP_W = VISIBLE * SLOT_W + (VISIBLE - 1) * SLOT_GAP; // 292

export default function Weather({ style }) {
  const [wx, setWx] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [offset, setOffset] = useState(0);
  const drag = useRef({ active: false, startX: 0, startOffset: 0 });

  useEffect(() => {
    const cached = loadCache();
    if (cached) { setWx(cached); return; }
    fetchWeather().then(setWx).catch(e => console.warn('Weather fetch failed:', e));
    const id = setInterval(() => {
      fetchWeather().then(setWx).catch(() => {});
    }, WX_TTL);
    return () => clearInterval(id);
  }, []);

  // reset offset when collapsing
  useEffect(() => { if (!expanded) setOffset(0); }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onMove = (e) => {
      if (!drag.current.active) return;
      const delta = e.clientX - drag.current.startX;
      const totalW = (wx?.hours?.length ?? 0) * SLOT_W + ((wx?.hours?.length ?? 1) - 1) * SLOT_GAP;
      const maxOff = Math.max(0, totalW - STRIP_W);
      setOffset(Math.max(-maxOff, Math.min(0, drag.current.startOffset + delta)));
    };
    const onUp = () => { drag.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [expanded, wx]);

  if (!wx) return null;

  const { cur, hours } = wx;
  const icon = cur.weather[0].icon;
  const WxIcon = wxIcon(icon);
  const temp = Math.round(cur.main.temp);
  const cond = cur.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 14, borderLeft: '1px solid rgba(255,255,255,0.09)', ...style }}>

      {/* Current */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <WxIcon size={26} style={{ color: wxColor(icon), flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: wxTempColor(temp), lineHeight: 1 }}>{temp}</span>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>°</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{cond}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IconThermometer size={13} /><b style={{ color: 'var(--text2)', fontWeight: 500 }}>{Math.round(cur.main.feels_like)}</b>°</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IconDroplet size={13} /><b style={{ color: 'var(--text2)', fontWeight: 500 }}>{cur.main.humidity}</b>%</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IconWind size={13} /><b style={{ color: 'var(--text2)', fontWeight: 500 }}>{Math.round(cur.wind.speed * 3.6)}</b> km/h</span>
          </div>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          background: expanded ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 6,
          padding: '4px 6px',
          cursor: 'pointer',
          color: expanded ? 'var(--text)' : 'var(--text3)',
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
      >
        <IconChevronRight size={15} style={{ transform: expanded ? 'rotate(180deg) scaleX(0.5) scaleY(2)' : 'scaleX(0.5) scaleY(2)', transition: 'transform 0.2s' }} />
      </button>

      {/* Hourly strip */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
      {(() => {
        const totalW = hours.length * SLOT_W + (hours.length - 1) * SLOT_GAP;
        const maxOff = Math.max(0, totalW - STRIP_W);
        const canScrollRight = expanded && offset > -maxOff;
        return (
          <>
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: 40,
            background: 'linear-gradient(to right, transparent, var(--bg, #0d0d14))',
            pointerEvents: 'none',
            zIndex: 1,
            opacity: canScrollRight ? 1 : 0,
            transition: 'opacity 0.2s',
          }} />
      <div style={{
        overflow: 'hidden',
        width: expanded ? STRIP_W : 0,
        transition: 'width 0.25s ease',
        flexShrink: 0,
      }}>
        <div
          onMouseDown={(e) => {
            drag.current = { active: true, startX: e.clientX, startOffset: offset };
            e.preventDefault();
          }}
          style={{
            display: 'flex',
            gap: SLOT_GAP,
            transform: `translateX(${offset}px)`,
            transition: drag.current.active ? 'none' : 'transform 0.15s ease',
            cursor: 'grab',
            userSelect: 'none',
            paddingBottom: 2,
          }}
        >
          {hours.map(h => {
            const HIcon = wxIcon(h.icon);
            return (
              <div key={h.dt} style={{
                width: SLOT_W,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', fontWeight: 500, letterSpacing: '0.03em' }}>{fmtHour(h.dt)}</span>
                <HIcon size={18} style={{ color: wxColor(h.icon) }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: wxTempColor(h.temp) }}>{h.temp}°</span>
              </div>
            );
          })}
        </div>
      </div>
          </>
        );
      })()}
      </div>

    </div>
  );
}
