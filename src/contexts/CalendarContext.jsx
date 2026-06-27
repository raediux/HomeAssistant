import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { dbGetGoogleToken, dbLoadBadges } from '../db.js';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';

const CalendarContext = createContext(null);

async function refreshGoogleToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await fetch('/auth/google/refresh', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  });
  if (!res.ok) return null;
  return await res.json(); // { access_token, expires_at }
}

async function fetchGoogleEvents(accessToken, startDate, endDate) {
  const params = new URLSearchParams({
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json.items || []).map(e => ({
    id: e.id,
    title: e.summary || '(no title)',
    start: e.start.dateTime || e.start.date,
    end: e.end.dateTime || e.end.date,
  }));
}

export function CalendarProvider({ children }) {
  const [badges, setBadges] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [googleToken, setGoogleToken] = useState(null);

  useEffect(() => { dbLoadBadges().then(setBadges); }, []);

  useEffect(() => {
    dbGetGoogleToken().then(token => {
      if (token) {
        setHasGoogleToken(true);
        setGoogleToken(token);
      }
    });
  }, []);

  const fetchGoogleEventsForMonth = useCallback(async (year, month, token = googleToken) => {
    if (!token) return;

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);

    let { access_token, expires_at } = token;

    if (new Date(expires_at) < new Date(Date.now() + 60_000)) {
      const refreshed = await refreshGoogleToken();
      if (!refreshed) return;
      access_token = refreshed.access_token;
      setGoogleToken(prev => ({ ...prev, ...refreshed }));
    }

    let events = await fetchGoogleEvents(access_token, start, end);

    if (events === null) {
      const refreshed = await refreshGoogleToken();
      if (!refreshed) return;
      access_token = refreshed.access_token;
      setGoogleToken(prev => ({ ...prev, ...refreshed }));
      events = await fetchGoogleEvents(access_token, start, end);
    }

    if (events) setGoogleEvents(events);
  }, [googleToken]);

  useRealtimeSync('calendar_badges', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setBadges(prev => prev.filter(b => b.id !== old.id));
    } else {
      const badge = { id: row.id, date: row.date, label: row.label, color: row.color };
      setBadges(prev => prev.some(b => b.id === badge.id) ? prev.map(b => b.id === badge.id ? badge : b) : [...prev, badge]);
    }
  });

  return (
    <CalendarContext.Provider value={{ badges, setBadges, googleEvents, hasGoogleToken, fetchGoogleEventsForMonth }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendarData() { return useContext(CalendarContext); }
