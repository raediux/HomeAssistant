import { createContext, useContext, useEffect, useState } from 'react';
import { dbLoadMeals } from '../db.js';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';

const MealsContext = createContext(null);

export function MealsProvider({ children }) {
  const [meals, setMeals] = useState({});

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

  return <MealsContext.Provider value={{ meals, setMeals }}>{children}</MealsContext.Provider>;
}

export function useMealsData() { return useContext(MealsContext); }
