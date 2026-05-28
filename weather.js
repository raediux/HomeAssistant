// Weather widget — OpenWeatherMap data/2.5 + 30-min localStorage cache

const OWM_BASE    = 'https://api.openweathermap.org/data/2.5';
const WX_CACHE_KEY = 'ha_weather';
const WX_TTL      = 30 * 60 * 1000;

const WX_ICONS = {
  '01d':'ti-sun',         '01n':'ti-moon',
  '02d':'ti-cloud-sun',   '02n':'ti-cloud-moon',
  '03d':'ti-cloud',       '03n':'ti-cloud',
  '04d':'ti-cloud',       '04n':'ti-cloud',
  '09d':'ti-cloud-rain',  '09n':'ti-cloud-rain',
  '10d':'ti-cloud-rain',  '10n':'ti-cloud-rain',
  '11d':'ti-cloud-storm', '11n':'ti-cloud-storm',
  '13d':'ti-snowflake',   '13n':'ti-snowflake',
  '50d':'ti-mist',        '50n':'ti-mist',
};

function wxIcon(code) {
  return WX_ICONS[code] || WX_ICONS[code.slice(0, 2) + 'd'] || 'ti-cloud';
}

async function wxFetch() {
  const [cur, fore] = await Promise.all([
    fetch(`${OWM_BASE}/weather?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&units=metric&appid=${WEATHER_KEY}`).then(r => r.json()),
    fetch(`${OWM_BASE}/forecast?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&units=metric&cnt=40&appid=${WEATHER_KEY}`).then(r => r.json()),
  ]);

  // Surface API-level errors with a clear message
  if (cur.cod  && cur.cod  !== 200)    throw new Error(`OWM current: ${cur.message}`);
  if (fore.cod && fore.cod !== '200')  throw new Error(`OWM forecast: ${fore.message}`);

  // Group forecast 3-hr entries by local date, skipping today
  const todayStr = new Date().toLocaleDateString('en-AU');
  const dayMap = new Map();
  for (const item of fore.list) {
    const key = new Date(item.dt * 1000).toLocaleDateString('en-AU');
    if (key === todayStr) continue;
    if (!dayMap.has(key)) dayMap.set(key, { temps: [], items: [] });
    const bucket = dayMap.get(key);
    bucket.temps.push(item.main.temp);
    bucket.items.push(item);
  }

  // Build 3-day summary: accurate hi/lo from all entries, midday icon
  const days = [];
  for (const [, { temps, items }] of dayMap) {
    if (days.length >= 3) break;
    const mid = items.find(i => { const h = new Date(i.dt * 1000).getHours(); return h >= 11 && h <= 14; })
              || items[Math.floor(items.length / 2)];
    days.push({
      dt:   mid.dt,
      icon: mid.weather[0].icon,
      hi:   Math.round(Math.max(...temps)),
      lo:   Math.round(Math.min(...temps)),
    });
  }

  return { cur, days, ts: Date.now() };
}

function wxLoadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(WX_CACHE_KEY) || 'null');
    return c && (Date.now() - c.ts < WX_TTL) ? c : null;
  } catch { return null; }
}

function wxSaveCache(data) {
  try { localStorage.setItem(WX_CACHE_KEY, JSON.stringify(data)); } catch {}
}

function wxRender(data) {
  const { cur, days } = data;

  // Chip
  document.getElementById('weather-icon').className = `ti ${wxIcon(cur.weather[0].icon)}`;
  document.getElementById('weather-temp').textContent = `${Math.round(cur.main.temp)}°`;

  // Panel — current conditions
  document.getElementById('wp-temp').textContent      = Math.round(cur.main.temp);
  document.getElementById('wp-condition').textContent =
    cur.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
  document.getElementById('wp-feels').textContent     = Math.round(cur.main.feels_like);
  document.getElementById('wp-humidity').textContent  = cur.main.humidity;
  document.getElementById('wp-wind').textContent      = Math.round(cur.wind.speed * 3.6);

  // Panel — 3-day forecast strip
  const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  document.getElementById('forecast-strip').innerHTML = days.map(d => `
    <div class="forecast-card">
      <div class="fc-day">${DAY[new Date(d.dt * 1000).getDay()]}</div>
      <i class="ti ${wxIcon(d.icon)} fc-icon"></i>
      <div class="fc-temps"><span class="fc-hi">${d.hi}°</span><span class="fc-lo">${d.lo}°</span></div>
    </div>`).join('');
}

async function wxRefresh() {
  const cached = wxLoadCache();
  if (cached) { wxRender(cached); return; }
  try {
    const data = await wxFetch();
    wxSaveCache(data);
    wxRender(data);
  } catch (e) {
    console.warn('Weather fetch failed:', e);
  }
}

let _wxOpen = false;

function toggleWeatherPanel() {
  _wxOpen = !_wxOpen;
  document.getElementById('weather-panel').classList.toggle('open', _wxOpen);
}

function initWeather() {
  // Position panel flush against the bottom of the topbar
  const topbar = document.querySelector('.topbar');
  if (topbar) {
    document.getElementById('weather-panel').style.top =
      topbar.getBoundingClientRect().bottom + 'px';
  }

  wxRefresh();
  setInterval(wxRefresh, WX_TTL);

  // Close on outside click
  document.addEventListener('click', e => {
    if (_wxOpen && !e.target.closest('#weather-chip') && !e.target.closest('#weather-panel')) {
      _wxOpen = false;
      document.getElementById('weather-panel').classList.remove('open');
    }
  });
}

initWeather();
