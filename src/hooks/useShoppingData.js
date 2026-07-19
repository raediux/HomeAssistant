import { useEffect, useState } from 'react';
import { useUndo } from '../contexts/UndoContext.jsx';
import { dateStr, newId } from '../utils.js';
import { useRealtimeSync } from './useRealtimeSync.js';
import { markDeleted, unmarkDeleted, isDeleted } from '../utils/tombstones.js';
import {
  dbLoadWorkingItems, dbLoadPastItems,
  dbSaveWorkingItem, dbDeleteWorkingItem,
  dbSavePastItem, dbDeletePastItem,
  dbGetLastShoppingClear, dbSetLastShoppingClear,
} from '../db.js';
import { STORES } from '../config/stores.js';
import { SHOPPING_CLEAR_DAY } from '../config/shopping.js';

export { STORES };

// Merge a working item into the past list: bump times on a name+store match,
// otherwise prepend a new entry. Fires the DB save; returns the next list.
// Kept outside the hook (and outside setState updaters) so updaters stay pure.
function archiveIntoPast(pastList, item) {
  const existing = pastList.find(p => p.name.toLowerCase() === item.name.toLowerCase() && p.store === item.store);
  if (existing) {
    const updated = { ...existing, times: existing.times + 1 };
    dbSavePastItem(updated);
    return pastList.map(p => p.id === existing.id ? updated : p);
  }
  const newPast = { id: item.id, name: item.name, store: item.store, times: 1 };
  dbSavePastItem(newPast);
  return [newPast, ...pastList];
}

export function useShoppingData() {
  const { scheduleDelete } = useUndo();
  const [working, setWorking]             = useState([]);
  const [past, setPast]                   = useState([]);
  const [collapsed, setCollapsed]         = useState({});
  const [collapsedPast, setCollapsedPast] = useState({});
  const [modal, setModal]                 = useState(null);
  const [search, setSearch]               = useState('');

  useEffect(() => {
    Promise.all([dbLoadWorkingItems(), dbLoadPastItems(), dbGetLastShoppingClear()]).then(([w, p, lastClear]) => {
      const today = new Date();
      const isMonday = today.getDay() === SHOPPING_CLEAR_DAY;
      const todayKey = dateStr(today);

      let finalWorking = w;
      let finalPast = p;

      if (isMonday && lastClear !== todayKey && w.length > 0) {
        // Stamp first so a second device loading moments later skips the clear.
        dbSetLastShoppingClear(todayKey);
        finalWorking = [];
        for (const item of w) {
          dbDeleteWorkingItem(item.id);
          finalPast = archiveIntoPast(finalPast, item);
        }
      }

      setWorking(finalWorking);
      setPast(finalPast);
    });
  }, []);

  function toggleGot(id) {
    const item = working.find(i => i.id === id);
    if (!item) return;
    const updated = { ...item, got: !item.got };
    setWorking(prev => prev.map(i => i.id === id ? updated : i));
    dbSaveWorkingItem(updated);
  }

  function moveToArchive(id) {
    const item = working.find(i => i.id === id);
    if (!item) return;
    setWorking(prev => prev.filter(i => i.id !== id));
    dbDeleteWorkingItem(id);
    setPast(archiveIntoPast(past, item));
  }

  function deleteWorkingItem(id, name) {
    const idx  = working.findIndex(i => i.id === id);
    const item = working[idx];
    setWorking(prev => prev.filter(i => i.id !== id));
    scheduleDelete(
      `"${name}" deleted`,
      () => { markDeleted(id); dbDeleteWorkingItem(id); },
      () => {
        if (!item) return;
        unmarkDeleted(id);
        setWorking(prev => { const next = [...prev]; next.splice(idx, 0, item); return next; });
        dbSaveWorkingItem(item);
      },
    );
  }

  function clearAll() {
    if (!working.length) return;
    const items = [...working];
    setWorking([]);
    let nextPast = past;
    for (const item of items) {
      dbDeleteWorkingItem(item.id);
      nextPast = archiveIntoPast(nextPast, item);
    }
    setPast(nextPast);
  }

  function moveToList(id) {
    const item = past.find(i => i.id === id);
    if (!item) return;
    setPast(prev => prev.filter(i => i.id !== id));
    dbDeletePastItem(id);
    const newWorking = { id: item.id, name: item.name, qty: null, store: item.store, got: false, sort_order: working.length };
    setWorking(prev => [...prev, newWorking]);
    dbSaveWorkingItem(newWorking);
    setSearch('');
  }

  function deletePastItem(id, name) {
    const idx  = past.findIndex(i => i.id === id);
    const item = past[idx];
    setPast(prev => prev.filter(i => i.id !== id));
    scheduleDelete(
      `"${name}" deleted`,
      () => { markDeleted(id); dbDeletePastItem(id); },
      () => {
        if (!item) return;
        unmarkDeleted(id);
        setPast(prev => { const next = [...prev]; next.splice(idx, 0, item); return next; });
        dbSavePastItem(item);
      },
    );
  }

  function handleModalConfirm({ name, store }) {
    if (modal.editItem) {
      const { id, type } = modal.editItem;
      if (type === 'working') {
        const item = working.find(i => i.id === id);
        if (item) {
          const updated = { ...item, name, store };
          setWorking(prev => prev.map(i => i.id === id ? updated : i));
          dbSaveWorkingItem(updated);
        }
      } else {
        const item = past.find(i => i.id === id);
        if (item) {
          const updated = { ...item, name, store };
          setPast(prev => prev.map(i => i.id === id ? updated : i));
          dbSavePastItem(updated);
        }
      }
    } else {
      const item = { id: newId(), name, qty: null, store, got: false, sort_order: working.length };
      setWorking(prev => [...prev, item]);
      dbSaveWorkingItem(item);
    }
    setModal(null);
  }

  function groupByStore(items) {
    const groups = {};
    STORES.forEach(st => { groups[st] = []; });
    items.forEach(item => {
      const key = STORES.includes(item.store) ? item.store : 'Others';
      groups[key].push(item);
    });
    return groups;
  }

  useRealtimeSync('shopping_working', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setWorking(prev => prev.filter(i => i.id !== old.id));
    } else {
      if (isDeleted(row.id)) return;
      const item = { id: row.id, name: row.name, qty: row.qty, store: row.store, got: row.got, sort_order: row.sort_order ?? 0 };
      setWorking(prev => prev.some(i => i.id === item.id) ? prev.map(i => i.id === item.id ? item : i) : [...prev, item]);
    }
  });

  useRealtimeSync('shopping_past', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setPast(prev => prev.filter(i => i.id !== old.id));
    } else {
      if (isDeleted(row.id)) return;
      const item = { id: row.id, name: row.name, store: row.store, times: row.times, category: row.category };
      setPast(prev => prev.some(i => i.id === item.id) ? prev.map(i => i.id === item.id ? item : i) : [item, ...prev]);
    }
  });

  const workingGroups = groupByStore(working);
  const q = search.toLowerCase();
  const filteredPast = q ? past.filter(i => i.name.toLowerCase().includes(q)) : past;
  const pastGroups   = groupByStore(filteredPast);

  return {
    working, past,
    collapsed, setCollapsed,
    collapsedPast, setCollapsedPast,
    modal, setModal,
    search, setSearch,
    toggleGot, moveToArchive, deleteWorkingItem, clearAll,
    moveToList, deletePastItem, handleModalConfirm,
    workingGroups, filteredPast, pastGroups,
  };
}
