import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { IconX } from '@tabler/icons-react';

const SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.9 };

const STORES = ['Aldi','Asian Grocer','Big W','Butcher','Chemist Warehouse','Coles','Kmart','Korean Grocer','Pharmacy 4 Less','Ray Mum','Target','Woolworths','Others'];

export default function ShoppingModal({ editItem, defaultStore, pastItems, onConfirm, onClose }) {
  const inputRef = useRef(null);
  const [name, setName]   = useState('');
  const [store, setStore] = useState('Others');
  const [suggestions, setSuggestions] = useState([]);
  const [sugIndex, setSugIndex] = useState(-1);
  const isEdit = !!editItem;

  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setStore(STORES.includes(editItem.store) ? editItem.store : 'Others');
    } else {
      setName('');
      setStore(defaultStore || 'Others');
    }
    setSuggestions([]);
    setSugIndex(-1);
  }, [editItem, defaultStore]);

  function handleNameChange(val) {
    setName(val);
    if (isEdit || !val.trim()) { setSuggestions([]); return; }
    const q = val.trim().toLowerCase();
    const matches = pastItems
      .filter(i => i.name.toLowerCase().includes(q))
      .sort((a, b) => (b.times || 0) - (a.times || 0))
      .slice(0, 6);
    setSuggestions(matches);
    setSugIndex(-1);
  }

  function applySuggestion(item) {
    setName(item.name);
    if (STORES.includes(item.store)) setStore(item.store);
    setSuggestions([]);
    setSugIndex(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { if (suggestions.length) setSuggestions([]); else onClose(); return; }
    if (!suggestions.length) { if (e.key === 'Enter') handleConfirm(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSugIndex(i => Math.min(i + 1, suggestions.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSugIndex(i => Math.max(i - 1, -1)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (sugIndex >= 0 && suggestions[sugIndex]) applySuggestion(suggestions[sugIndex]);
      else handleConfirm();
    }
  }

  function toTitleCase(str) {
    return str.trim().replace(/\b\w/g, c => c.toUpperCase());
  }

  function handleConfirm() {
    const n = toTitleCase(name);
    if (!n) { inputRef.current?.focus(); return; }
    onConfirm({ name: n, store });
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  const re = name.trim() ? new RegExp(`(${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null;

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="modal-box" initial={{ scale: 0.88, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.88, y: 16, opacity: 0 }} transition={SPRING}>
        <div className="modal-hdr">
          <span>{isEdit ? 'Edit item' : 'Add item'}</span>
          <button className="modal-x" onClick={onClose}><IconX size={18} /></button>
        </div>

        <label className="modal-lbl">Item name</label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            ref={inputRef}
            autoFocus
            className="modal-input"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Milk"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10, background: '#1e1e1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--r)', boxShadow: '0 8px 24px rgba(0,0,0,.5)', overflow: 'hidden' }}>
              {suggestions.map((item, i) => {
                const safe = escapeHtml(item.name);
                const highlighted = re ? safe.replace(re, '<em style="font-style:normal;color:var(--accent)">$1</em>') : safe;
                return (
                  <div
                    key={item.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, background: i === sugIndex ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background .1s' }}
                    onMouseDown={() => applySuggestion(item)}
                  >
                    <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: highlighted }} />
                    <span style={{ fontSize: 11, color: 'var(--text3)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap' }}>{item.store}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <label className="modal-lbl">Store</label>
        <select className="modal-input" style={{ marginBottom: 12 }} value={store} onChange={e => setStore(e.target.value)}>
          {STORES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="modal-ftr">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            {isEdit ? 'Save' : 'Add to list'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
