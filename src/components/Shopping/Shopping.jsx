import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { useTilt } from '../../hooks/useTilt.js';
import { IconCheck, IconPencil, IconArrowBackUp, IconPlus, IconSearch, IconChevronDown, IconTrash } from '@tabler/icons-react';
import {
  dbLoadWorkingItems, dbLoadPastItems,
  dbSaveWorkingItem, dbDeleteWorkingItem,
  dbSavePastItem, dbDeletePastItem,
} from '../../db.js';
import ShoppingModal from './ShoppingModal.jsx';
import s from './Shopping.module.css';

const STORES = ['Aldi','Asian Grocer','Big W','Butcher','Chemist Warehouse','Coles','Kmart','Korean Grocer','Pharmacy 4 Less','Ray Mum','Target','Woolworths','Others'];

export default function Shopping({ embedded = false }) {
  const [working, setWorking]             = useState([]);
  const [past, setPast]                   = useState([]);
  const [collapsed, setCollapsed]         = useState({});
  const [collapsedPast, setCollapsedPast] = useState({});
  const [modal, setModal]                 = useState(null); // { editItem, defaultStore }
  const [search, setSearch]               = useState('');
  const nextId = useRef(100);
  const pastPanelRef = useRef(null);

  useEffect(() => {
    Promise.all([dbLoadWorkingItems(), dbLoadPastItems()]).then(([w, p]) => {
      setWorking(w);
      setPast(p);
      const maxId = Math.max(...w.map(i => i.id), ...p.map(i => i.id), 99);
      nextId.current = maxId + 1;
    });
  }, []);

  // ── Working list actions ──────────────────────────────────────
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

  // ── Modal ─────────────────────────────────────────────────────
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

  // ── Group by store ────────────────────────────────────────────
  function groupByStore(items) {
    const groups = {};
    STORES.forEach(s => { groups[s] = []; });
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

  return (
    <div className={s.panel}>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Shopping</span>
          <button className={s.addBtn} onClick={() => setModal({ editItem: null, defaultStore: null })}>
            <IconPlus size={13} /> Add item
          </button>
        </div>
      )}

      <div className={s.panels} style={embedded ? { marginTop: 0, borderRadius: 0, border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', flex: 1, minHeight: 0 } : {}}>
        {/* ── Active list ── */}
        <div className={s.shopPanel}>
          <div className={s.panelHdr}>
            <span className={s.panelTitle}>This Week</span>
            <button className={s.clearBtn} onClick={clearAll}>Clear all</button>
          </div>

          {working.length === 0 && <p className={s.empty}>No items — add from All Items or create new</p>}

          {STORES.filter(st => workingGroups[st].length > 0).map(st => {
            const items = [...workingGroups[st]].sort((a, b) => Number(a.got) - Number(b.got));
            const isCollapsed = collapsed[st];
            return (
              <div key={st} className={s.catSection}>
                <div className={s.catHeader} onClick={() => setCollapsed(p => ({ ...p, [st]: !p[st] }))}>
                  <span className={s.catLabel}>{st}</span>
                  <span className={s.catLine} />
                  <span className={s.catCount}>{items.length}</span>
                  <button className={s.catAddBtn} title={`Add to ${st}`} onClick={e => { e.stopPropagation(); setModal({ editItem: null, defaultStore: st }); }}>
                    <IconPlus size={12} />
                  </button>
                  <IconChevronDown size={13} className={`${s.catChevron} ${isCollapsed ? s.collapsed : ''}`} />
                </div>
                <div className={`${s.catBody} ${isCollapsed ? s.collapsed : ''}`}>
                  <AnimatePresence initial={false}>
                  {items.map(item => (
                    <WorkingItem
                      key={item.id}
                      item={item}
                      onToggle={() => toggleGot(item.id)}
                      onDelete={() => deleteWorkingItem(item.id)}
                      onEdit={() => setModal({ editItem: { id: item.id, type: 'working', name: item.name, store: item.store }, defaultStore: null })}
                      onArchive={() => moveToArchive(item.id)}
                    />
                  ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Past / All items ── */}
        <div className={s.shopPanel}>
          <div className={s.panelHdr}>
            <span className={s.panelTitle}>All Items</span>
          </div>
          <div className={s.searchRow}>
            <div className={s.searchBar}>
              <IconSearch size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} />
              <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className={s.addBtn} onClick={() => setModal({ editItem: null, defaultStore: null })}>
              <IconPlus size={13} /> Add
            </button>
          </div>

          {filteredPast.length === 0 && <p className={s.empty}>No matches</p>}

          {q ? (
            <AnimatePresence initial={false}>
              {filteredPast.map(item => <PastItem key={item.id} item={item} onMove={moveToList} onEdit={item => setModal({ editItem: { ...item, type: 'past' }, defaultStore: null })} onDelete={deletePastItem} />)}
            </AnimatePresence>
          ) : (
            STORES.filter(st => pastGroups[st].length > 0).map(st => {
              const items = pastGroups[st];
              const isCollapsed = collapsedPast[st];
              return (
                <div key={st} className={s.catSection}>
                  <div className={s.catHeader} onClick={() => setCollapsedPast(p => ({ ...p, [st]: !p[st] }))}>
                    <span className={s.catLabel}>{st}</span>
                    <span className={s.catLine} />
                    <span className={s.catCount}>{items.length}</span>
                    <IconChevronDown size={13} className={`${s.catChevron} ${isCollapsed ? s.collapsed : ''}`} />
                  </div>
                  <div className={`${s.catBody} ${isCollapsed ? s.collapsed : ''}`}>
                    <AnimatePresence initial={false}>
                      {items.map(item => <PastItem key={item.id} item={item} onMove={moveToList} onEdit={item => setModal({ editItem: { ...item, type: 'past' }, defaultStore: null })} onDelete={deletePastItem} />)}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {modal && (
        <ShoppingModal
          editItem={modal.editItem}
          defaultStore={modal.defaultStore}
          pastItems={past}
          onConfirm={handleModalConfirm}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function WorkingItem({ item, onToggle, onDelete, onEdit, onArchive }) {
  const controls = useAnimation();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (item.got) controls.start({
      boxShadow: ['0 0 0px rgba(80,200,120,0)', '0 0 16px rgba(80,200,120,0.45)', '0 0 0px rgba(80,200,120,0)'],
      transition: { duration: 0.5 },
    });
  }, [item.got]);

  return (
    <motion.div
      layout
      animate={controls}
      initial={{ opacity: 0, x: -12 }}
      exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0 }}
      transition={{ layout: { type: 'spring', stiffness: 500, damping: 35 }, duration: 0.22 }}
      className={`${s.sItem} ${item.got ? s.done : ''}`}
      onClick={onToggle}
      onTouchEnd={e => { e.preventDefault(); onToggle(); }}
    >
      <motion.div
        className={`${s.circle} ${item.got ? s.checked : ''}`}
        animate={{ scale: item.got ? [1, 1.45, 1] : 1 }}
        transition={{ duration: 0.25 }}
      >
        {item.got && <IconCheck size={9} />}
      </motion.div>
      <div className={s.sMoveZone}>
        <span className={s.sName}>{item.name}</span>
      </div>
      <div className={s.itemActions} onClick={e => e.stopPropagation()}>
        <button className={`${s.moveBtn} ${s.del}`} title="Delete" onClick={onDelete}><IconTrash size={12} /></button>
        <button className={`${s.moveBtn} ${s.edt}`} title="Edit" onClick={onEdit}><IconPencil size={12} /></button>
        <button className={`${s.moveBtn} ${s.rem}`} title="Move back to All Items" onClick={onArchive}><IconArrowBackUp size={12} /></button>
      </div>
    </motion.div>
  );
}

function PastItem({ item, onMove, onEdit, onDelete }) {
  const { ref, rotateX, rotateY, onMouseMove, onMouseLeave } = useTilt(4);
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0 }}
      transition={{ layout: { type: 'spring', stiffness: 500, damping: 35 }, duration: 0.22 }}
      style={{ rotateX, rotateY, transformPerspective: 600 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={s.pItem}
    >
      <div className={s.pMoveZone} onClick={() => onMove(item.id)}>
        <span className={s.pName}>{item.name}</span>
      </div>
      <div className={s.itemActions}>
        <button className={`${s.moveBtn} ${s.del}`} title="Delete" onClick={() => onDelete(item.id)}><IconTrash size={12} /></button>
        <button className={`${s.moveBtn} ${s.edt}`} title="Edit" onClick={() => onEdit(item)}><IconPencil size={12} /></button>
      </div>
    </motion.div>
  );
}
