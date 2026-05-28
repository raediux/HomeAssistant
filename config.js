// ── Supabase credentials ──────────────────────────────────────
// Replace the placeholder values below with your project's URL and anon key.
// The anon key is safe to include in client-side code — Supabase is designed for this.
const SUPABASE_URL      = 'https://vvowkcqeklvfgqlbevce.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2b3drY3Fla2x2ZmdxbGJldmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NjQyMTEsImV4cCI6MjA5NTM0MDIxMX0.9Yagctx8CPx9474cPrwnbGav10rwRql_Eu0RNbSp8bI';

// ── PIN auth ──────────────────────────────────────────────────
// SHA-256 hash of your chosen PIN. To generate:
//   1. Open browser DevTools console
//   2. Run: crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpin'))
//            .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
//   3. Paste the resulting hex string below.
//
// Default PIN is: 1234  (change this before going live)
const PIN_HASH = '07f462860f43a53170feef6adc63c67dbf1f6725ae35789afd02c57fc6a22e1b';

// ── Weather ──────────────────────────────────────────────────
const WEATHER_KEY = '04fa365af38c4ba472cd335ebef90ce1';
const WEATHER_LAT = -33.8154;
const WEATHER_LON = 151.0285;
