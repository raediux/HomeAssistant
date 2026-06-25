import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { IconCheck, IconPencil, IconArrowBackUp, IconPlus, IconChevronDown, IconTrash } from '@tabler/icons-react';
import { STORES } from '../../hooks/useShoppingData.js';
import s from './Shopping.module.css';

export default function ShoppingWorkingPanel({ shopData, showAddBtn, noWrapper }) {
  const { working, workingGroups, collapsed, setCollapsed, toggleGot, deleteWorkingItem, moveToArchive, clearAll, setModal } = shopData;

  const content = (
    <>
      <div className={s.panelHdr}>
        <span className={s.panelTitle}>This Week</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {showAddBtn && (
            <button className={s.addBtn} onClick={() => setModal({ editItem: null, defaultStore: null })}>
              <IconPlus size={13} /> Add
            </button>
          )}
          <button className={s.clearBtn} onClick={clearAll}>Clear all</button>
        </div>
      </div>

      {working.length === 0 && <p className={s.empty}>No items — add from All Items or create new</p>}

      {STORES.filter(st => workingGroups[st].length > 0).map(st => {
        const items = [...workingGroups[st]].sort((a, b) => Number(a.got) - Number(b.got) || a.name.localeCompare(b.name));
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
                    onDelete={() => deleteWorkingItem(item.id, item.name)}
                    onEdit={() => setModal({ editItem: { id: item.id, type: 'working', name: item.name, store: item.store }, defaultStore: null })}
                    onArchive={() => moveToArchive(item.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </>
  );

  if (noWrapper) return content;
  return <div className={s.shopPanel}>{content}</div>;
}

function WorkingItem({ item, onToggle, onDelete, onEdit, onArchive }) {
  const controls = useAnimation();
  const firstRender = useRef(true);


  useEffect(() => { controls.start({ opacity: 1, x: 0 }); }, []);

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
      style={{ transformStyle: 'preserve-3d', transformPerspective: 800 }}
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
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'rgba(0,0,0,0.55)', transform: 'translateZ(-6px)', pointerEvents: 'none' }} />
    </motion.div>
  );
}
