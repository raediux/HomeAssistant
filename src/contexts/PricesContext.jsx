import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dbLoadPriceItems, dbCheckPrices, sortSources } from '../db.js';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';

const PricesContext = createContext(null);

export function PricesProvider({ children }) {
  const [items, setItems]       = useState([]);
  const [checking, setChecking] = useState(false);
  const [lastRun, setLastRun]   = useState(null);

  useEffect(() => { dbLoadPriceItems().then(setItems); }, []);

  // The edge function writes with the service key, so its updates arrive here the
  // same way another device's would — including the overnight cron run.
  useRealtimeSync('price_items', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setItems(prev => prev.filter(i => i.id !== old.id));
    } else {
      // The payload carries the product row only, so preserve the sources we
      // already hold rather than blanking the retailer list on every price write.
      setItems(prev => prev.some(i => i.id === row.id)
        ? prev.map(i => i.id === row.id ? { ...row, sources: i.sources ?? [] } : i)
        : [...prev, { ...row, sources: [] }]);
    }
  });

  useRealtimeSync('price_sources', ({ eventType, new: row, old }) => {
    setItems(prev => prev.map(item => {
      if (eventType === 'DELETE') {
        if (!item.sources?.some(s => s.id === old.id)) return item;
        return { ...item, sources: item.sources.filter(s => s.id !== old.id) };
      }
      if (row.item_id !== item.id) {
        // A link can't move between products, but drop any stale copy just in case.
        return item.sources?.some(s => s.id === row.id)
          ? { ...item, sources: item.sources.filter(s => s.id !== row.id) }
          : item;
      }
      const sources = item.sources?.some(s => s.id === row.id)
        ? item.sources.map(s => s.id === row.id ? row : s)
        : [...(item.sources ?? []), row];
      return { ...item, sources: sortSources(sources) };
    }));
  });

  const checkNow = useCallback(async () => {
    setChecking(true);
    const summary = await dbCheckPrices();
    setChecking(false);
    setLastRun(summary);
    // Realtime delivers the updated rows, but a re-read covers a dropped socket.
    dbLoadPriceItems().then(setItems);
    return summary;
  }, []);

  const unseenCount = items.filter(i => i.on_sale && !i.seen).length;

  return (
    <PricesContext.Provider value={{ items, setItems, checking, checkNow, lastRun, unseenCount }}>
      {children}
    </PricesContext.Provider>
  );
}

export function usePrices() { return useContext(PricesContext); }
