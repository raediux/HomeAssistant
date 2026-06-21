import { AnimatePresence, motion } from 'framer-motion';
import { IconPencil, IconSearch, IconPlus, IconChevronDown, IconTrash } from '@tabler/icons-react';
import { useTilt } from '../../hooks/useTilt.js';
import { STORES } from '../../hooks/useShoppingData.js';
import s from './Shopping.module.css';

export default function ShoppingPastPanel({ shopData, noWrapper }) {
  const { filteredPast, pastGroups, search, setSearch, collapsedPast, setCollapsedPast, moveToList, deletePastItem, setModal } = shopData;
  const q = search.toLowerCase();

  const content = (
    <>
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
          {filteredPast.map(item => (
            <PastItem key={item.id} item={item}
              onMove={() => moveToList(item.id)}
              onEdit={() => setModal({ editItem: { ...item, type: 'past' }, defaultStore: null })}
              onDelete={() => deletePastItem(item.id, item.name)}
            />
          ))}
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
                  {items.map(item => (
                    <PastItem key={item.id} item={item}
                      onMove={() => moveToList(item.id)}
                      onEdit={() => setModal({ editItem: { ...item, type: 'past' }, defaultStore: null })}
                      onDelete={() => deletePastItem(item.id, item.name)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })
      )}
    </>
  );

  if (noWrapper) return content;
  return <div className={s.shopPanel}>{content}</div>;
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
      style={{ rotateX, rotateY, transformPerspective: 600, transformStyle: 'preserve-3d' }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={s.pItem}
    >
      <div className={s.pMoveZone} onClick={onMove}>
        <span className={s.pName}>{item.name}</span>
      </div>
      <div className={s.itemActions}>
        <button className={`${s.moveBtn} ${s.del}`} title="Delete" onClick={onDelete}><IconTrash size={12} /></button>
        <button className={`${s.moveBtn} ${s.edt}`} title="Edit" onClick={onEdit}><IconPencil size={12} /></button>
      </div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'rgba(0,0,0,0.55)', transform: 'translateZ(-6px)', pointerEvents: 'none' }} />
    </motion.div>
  );
}
