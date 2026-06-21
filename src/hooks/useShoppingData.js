import { useEffect, useRef, useState } from 'react';
import {
  dbLoadWorkingItems, dbLoadPastItems,
  dbSaveWorkingItem, dbDeleteWorkingItem,
  dbSavePastItem, dbDeletePastItem,
} from '../db.js';

export const STORES = ['Aldi','Asian Grocer','Big W','Butcher','Chemist Warehouse','Coles','Kmart','Korean Grocer','Pharmacy 4 Less','Ray Mum','Target','Woolworths','Others'];

export function useShoppingData() {
  const [working, setWorking]             = useState([]);
  const [past, setPast]                   = useState([]);
  const [collapsed, setCollapsed]         = useState({});
  const [collapsedPast, setCollapsedPast] = useState({});
  const [modal, setModal]                 = useState(null);
  const [search, setSearch]               = useState('');
  const nextId = useRef(100);

  useEffect(() => {
    Promise.all([dbLoadWorkingItems(), dbLoadPastItems()]).then(([w, p]) => {
      setWorking(w);
      setPast(p);
      const maxId = Math.max(...w.map(i => i.id), ...p.map(i => i.id), 99);
      nextId.current = maxId + 1;
    });
  }, []);

  function toggleGot(id) {
    setWorking(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, got: !i.got } : i);
      dbSaveWorkingItem(updated.find(i => i.id === id));
      return updated;
    });
  }

  function moveToArchive(id) {
    const item = working.find(i => i.id === id);
    if (!item) return;
    setWorking(prev => prev.filter(i => i.id !== id));
    dbDeleteWorkingItem(id);
    setPast(prev => {
      const existing = prev.find(p => p.name.toLowerCase() === item.name.toLowerCase());
      if (existing) {
        const updated = prev.map(p => p.name.toLowerCase() === item.name.toLowerCase() ? { ...p, times: p.times + 1 } : p);
        dbSavePastItem(updated.find(p => p.name.toLowerCase() === item.name.toLowerCase()));
        return updated;
      }
      const newPast = { id: item.id, name: item.name, store: item.store, times: 1 };
      dbSavePastItem(newPast);
      return [newPast, ...prev];
    });
  }

  function deleteWorkingItem(id) {
    setWorking(prev => prev.filter(i => i.id !== id));
    dbDeleteWorkingItem(id);
  }

  function clearAll() {
    if (!working.length) return;
    const items = [...working];
    setWorking([]);
    items.forEach(item => {
      dbDeleteWorkingItem(item.id);
      setPast(prev => {
        const existing = prev.find(p => p.name.toLowerCase() === item.name.toLowerCase());
        if (existing) {
          const updated = prev.map(p => p.name.toLowerCase() === item.name.toLowerCase() ? { ...p, times: p.times + 1 } : p);
          dbSavePastItem(updated.find(p => p.name.toLowerCase() === item.name.toLowerCase()));
          return updated;
        }
        const newPast = { id: item.id, name: item.name, store: item.store, times: 1 };
        dbSavePastItem(newPast);
        return [newPast, ...prev];
      });
    });
  }

  function moveToList(id) {
    const item = past.find(i => i.id === id);
    if (!item) return;
    setPast(prev => prev.filter(i => i.id !== id));
    dbDeletePastItem(id);
    const newWorking = { id: item.id, name: item.name, qty: null, store: item.store, got: false, sort_order: working.length };
    setWorking(prev => [...prev, newWorking]);
    dbSaveWorkingItem(newWorking);
  }

  function deletePastItem(id) {
    setPast(prev => prev.filter(i => i.id !== id));
    dbDeletePastItem(id);
  }

  function handleModalConfirm({ name, store }) {
    if (modal.editItem) {
      const { id, type } = modal.editItem;
      if (type === 'working') {
        setWorking(prev => {
          const updated = prev.map(i => i.id === id ? { ...i, name, store } : i);
          dbSaveWorkingItem(updated.find(i => i.id === id));
          return updated;
        });
      } else {
        setPast(prev => {
          const updated = prev.map(i => i.id === id ? { ...i, name, store } : i);
          dbSavePastItem(updated.find(i => i.id === id));
          return updated;
        });
      }
    } else {
      const item = { id: nextId.current++, name, qty: null, store, got: false, sort_order: working.length };
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
    nextId,
    toggleGot, moveToArchive, deleteWorkingItem, clearAll,
    moveToList, deletePastItem, handleModalConfirm,
    workingGroups, filteredPast, pastGroups,
  };
}
