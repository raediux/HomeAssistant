import { useEffect, useState } from 'react';
import {
  IconSun, IconMoon, IconCloud,
  IconCloudRain, IconCloudStorm, IconCloudSnow, IconCloudFog,
  IconThermometer, IconDroplet, IconWind,
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

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function wxIcon(code) { return ICON_MAP[code] || ICON_MAP[code.slice(0,2)+'d'] || IconCloud; }
function wxColor(code) { return COLOR_MAP[code.slice(0,2)] || 'var(--text2)'; }
function wxTempColor(t) { return t < 10 ? '#6db0e0' : t > 20 ? '#e8b04a' : 'var(--text)'; }

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
  if (cur.cod && cur.cod !== 200)   throw new Error(cur.message);
  if (fore.cod && fore.cod !== '200') throw new Error(fore.message);

  const todayStr = new Date().toLocaleDateString('en-AU');
  const dayMap = new Map();
  for (const item of fore.list) {
    const key = new Date(item.dt * 1000).toLocaleDateString('en-AU');
    if (key === todayStr) continue;
    if (!dayMap.has(key)) dayMap.set(key, { temps: [], items: [] });
    const b = dayMap.get(key);
    b.temps.push(item.main.temp);
    b.items.push(item);
  }

  const days = [];
  for (const [, { temps, items }] of dayMap) {
    if (days.length >= 3) break;
    const mid = items.find(i => { const h = new Date(i.dt*1000).getHours(); return h>=11 && h<=14; })
              || items[Math.floor(items.length/2)];
    days.push({ dt: mid.dt, icon: mid.weather[0].icon, hi: Math.round(Math.max(...temps)), lo: Math.round(Math.min(...temps)) });
  }

  const data = { cur, days, ts: Date.now() };
  try { localStorage.setItem(WX_CACHE_KEY, JSON.stringify(data)); } catch {}
  return data;
}

export default function Weather({ style }) {
  const [wx, setWx] = useState(null);

  useEffect(() => {
    const cached = loadCache();
    if (cached) { setWx(cached); return; }
    fetchWeather().then(setWx).catch(e => console.warn('Weather fetch failed:', e));
    const id = setInterval(() => {
      fetchWeather().then(setWx).catch(() => {});
    }, WX_TTL);
    return () => clearInterval(id);
  }, []);

  if (!wx) return null;

  const { cur, days } = wx;
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

      {/* Divider */}
      <div style={{ width: 1, background: 'rgba(255,255,255,0.09)', alignSelf: 'stretch', margin: '4px 0' }} />

      {/* Forecast strip */}
      <div style={{ display: 'flex', gap: 16 }}>
        {days.map(d => {
          const FcIcon = wxIcon(d.icon);
          return (
            <div key={d.dt} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{DAY_NAMES[new Date(d.dt*1000).getDay()]}</span>
              <FcIcon size={20} style={{ color: wxColor(d.icon) }} />
              <div style={{ display: 'flex', gap: 5, fontSize: 12 }}>
                <span style={{ color: '#c9913a', fontWeight: 500 }}>{d.hi}°</span>
                <span style={{ color: '#5a87aa' }}>{d.lo}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
