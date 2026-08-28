import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { dbGetGoogleToken, dbLoadBadges } from '../db.js';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';
import { isDeleted } from '../utils/tombstones.js';

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

// Google's own sidebar checkboxes decide what reaches the app — a calendar
// unticked there comes back `selected: false` and is skipped. Subscribed feeds
// (an Outlook .ics, a shared calendar) are ordinary entries here, which is what
// makes them show up alongside the primary calendar.
async function fetchCalendarList(accessToken) {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json.items || [])
    .filter(c => c.selected !== false && !c.deleted)
    .map(c => ({
      id: c.id,
      name: c.summaryOverride || c.summary || c.id,
      color: c.backgroundColor || '#4a8fd4',
    }));
}

async function fetchCalendarEvents(accessToken, calendar, startDate, endDate) {
  const params = new URLSearchParams({
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json.items || [])
    .filter(e => e.status !== 'cancelled' && e.start)
    .map(e => ({
      id: e.id,
      // Ids are only unique per calendar, and one invite can sit on several.
      uid: e.iCalUID || `${calendar.id}::${e.id}`,
      key: `${calendar.id}::${e.id}`,
      calendarName: calendar.name,
      color: calendar.color,
      title: e.summary || '(no title)',
      start: e.start.dateTime || e.start.date,
      end: e.end.dateTime || e.end.date,
    }));
}

// Null means the token itself was rejected, so the caller can refresh and retry.
// A single calendar failing (removed, permissions changed) is skipped instead —
// one bad feed shouldn't blank out the whole month.
async function fetchAllGoogleEvents(accessToken, startDate, endDate) {
  const calendars = await fetchCalendarList(accessToken);
  if (calendars === null) return null;

  const results = await Promise.all(
    calendars.map(c => fetchCalendarEvents(accessToken, c, startDate, endDate))
  );

  const seen = new Set();
  const events = [];
  for (const list of results) {
    if (!list) continue;
    for (const e of list) {
      if (seen.has(e.uid)) continue;   // first calendar to carry the event wins
      seen.add(e.uid);
      events.push(e);
    }
  }
  // All-day starts are bare dates, timed ones are full ISO — lexical order puts
  // all-day events first within their day, which is the order we want anyway.
  return events.sort((a, b) => a.start.localeCompare(b.start));
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

    let events = await fetchAllGoogleEvents(access_token, start, end);

    if (events === null) {
      const refreshed = await refreshGoogleToken();
      if (!refreshed) return;
      access_token = refreshed.access_token;
      setGoogleToken(prev => ({ ...prev, ...refreshed }));
      events = await fetchAllGoogleEvents(access_token, start, end);
    }

    if (events) setGoogleEvents(events);
  }, [googleToken]);

  useRealtimeSync('calendar_badges', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setBadges(prev => prev.filter(b => b.id !== old.id));
    } else {
      if (isDeleted(row.id)) return;
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
