import { createContext, useContext, useEffect, useState } from 'react';
import { dbLoadBadges } from '../db.js';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';

const CalendarContext = createContext(null);

export function CalendarProvider({ children }) {
  const [badges, setBadges] = useState([]);

  useEffect(() => { dbLoadBadges().then(setBadges); }, []);

  useRealtimeSync('calendar_badges', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setBadges(prev => prev.filter(b => b.id !== old.id));
    } else {
      const badge = { id: row.id, date: row.date, label: row.label, color: row.color };
      setBadges(prev => prev.some(b => b.id === badge.id) ? prev.map(b => b.id === badge.id ? badge : b) : [...prev, badge]);
    }
  });

  return <CalendarContext.Provider value={{ badges, setBadges }}>{children}</CalendarContext.Provider>;
}

export function useCalendarData() { return useContext(CalendarContext); }
