import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://vvowkcqeklvfgqlbevce.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2b3drY3Fla2x2ZmdxbGJldmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NjQyMTEsImV4cCI6MjA5NTM0MDIxMX0.9Yagctx8CPx9474cPrwnbGav10rwRql_Eu0RNbSp8bI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const WEATHER_KEY = '04fa365af38c4ba472cd335ebef90ce1';
export const WEATHER_LAT = -33.8154;
export const WEATHER_LON = 151.0285;
