import { createContext, useContext, useEffect, useState } from 'react';
import { dbLoadMeals, dbLoadMealShareWeeks } from '../db.js';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';

const MealsContext = createContext(null);

export function MealsProvider({ children }) {
  const [meals, setMeals] = useState({});
  // Per-week sharing overrides: { [weekStart]: [memberId, ...] }. Absence of a
  // key means that week inherits the household default (members.sharesMeals).
  const [shareWeeks, setShareWeeks] = useState({});

  useEffect(() => {
    dbLoadMeals().then(rows => {
      const map = {};
      for (const r of rows) {
        if (!map[r.date]) map[r.date] = {};
        if (!map[r.date][r.person]) map[r.date][r.person] = {};
        map[r.date][r.person][r.slot] = r.meal;
      }
      setMeals(map);
    });
    dbLoadMealShareWeeks().then(rows => {
      const map = {};
      for (const r of rows) map[r.week_start] = r.member_ids || [];
      setShareWeeks(map);
    });
  }, []);

  useRealtimeSync('meal_plans', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      const r = old;
      setMeals(prev => {
        if (!prev[r.date]?.[r.person]) return prev;
        const next = { ...prev, [r.date]: { ...prev[r.date], [r.person]: { ...prev[r.date][r.person] } } };
        delete next[r.date][r.person][r.slot];
        return next;
      });
    } else {
      setMeals(prev => ({
        ...prev,
        [row.date]: { ...prev[row.date], [row.person]: { ...prev[row.date]?.[row.person], [row.slot]: row.meal } },
      }));
    }
  });

  useRealtimeSync('meal_share_weeks', ({ eventType, new: row, old }) => {
    setShareWeeks(prev => {
      const next = { ...prev };
      if (eventType === 'DELETE') delete next[old.week_start];
      else next[row.week_start] = row.member_ids || [];
      return next;
    });
  });

  return (
    <MealsContext.Provider value={{ meals, setMeals, shareWeeks, setShareWeeks }}>
      {children}
    </MealsContext.Provider>
  );
}

export function useMealsData() { return useContext(MealsContext); }
