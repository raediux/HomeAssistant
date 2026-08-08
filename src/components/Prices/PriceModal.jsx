import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { IconX, IconLoader2 } from '@tabler/icons-react';
import { dbProbeUrl } from '../../db.js';
import s from './Prices.module.css';

const SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.9 };

export default function PriceModal({ editItem, onConfirm, onClose }) {
  const isEdit = !!editItem;
  const urlRef = useRef(null);
  // Mounted fresh per open (rendered conditionally), so initializers suffice.
  const [url,    setUrl]    = useState(editItem?.url || '');
  const [name,   setName]   = useState(editItem?.name || '');
  const [target, setTarget] = useState(editItem?.target_price ?? '');
  const [drop,   setDrop]   = useState(editItem?.drop_pct ?? 5);
  const [probing, setProbing] = useState(false);
  const [probe,  setProbe]  = useState(null);
  const probedUrl = useRef(editItem?.url || '');

  // Read the page once as soon as we have a link, so the name, picture and
  // current price are filled in before the item is even saved.
  async function runProbe(value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === probedUrl.current) return;
    if (!/^https?:\/\//i.test(trimmed)) return;
    probedUrl.current = trimmed;
    setProbing(true);
    const result = await dbProbeUrl(trimmed);
    setProbing(false);
    setProbe(result);
    if (result?.ok) {
      setName(prev => prev.trim() || (result.title || '').slice(0, 90));
    }
  }

  function handleConfirm() {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) { urlRef.current?.focus(); return; }
    const targetNum = target === '' ? null : Number(target);
    const dropNum   = drop  === '' ? null : Number(drop);
    onConfirm({
      url: u,
      name: name.trim() || probe?.title?.slice(0, 90) || u,
      target_price: Number.isFinite(targetNum) ? targetNum : null,
      drop_pct: Number.isFinite(dropNum) ? dropNum : null,
      // Only seed from the probe on create — editing must not overwrite tracked history.
      probe: isEdit ? null : probe,
    });
  }

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        className="modal-box"
        initial={{ scale: 0.88, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 16, opacity: 0 }}
        transition={SPRING}
      >
        <div className="modal-hdr">
          <span>{isEdit ? 'Edit item' : 'Track a price'}</span>
          <button className="modal-x" onClick={onClose}><IconX size={18} /></button>
        </div>

        <label className="modal-lbl">Product link</label>
        <input
          ref={urlRef}
          autoFocus={!isEdit}
          className="modal-input"
          style={{ marginBottom: 6 }}
          value={url}
          onChange={e => setUrl(e.target.value)}
          onBlur={e => runProbe(e.target.value)}
          onPaste={e => {
            const pasted = e.clipboardData.getData('text');
            if (pasted) setTimeout(() => runProbe(pasted), 0);
          }}
          onKeyDown={e => { if (e.key === 'Enter') runProbe(e.currentTarget.value); }}
          placeholder="https://www.jbhifi.com.au/products/…"
          autoComplete="off"
          spellCheck="false"
        />

        <ProbeStatus probing={probing} probe={probe} />

        <label className="modal-lbl">Name</label>
        <input
          className="modal-input"
          style={{ marginBottom: 12 }}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Filled in from the page"
        />

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="modal-lbl">Alert at or below</label>
            <input
              className="modal-input"
              type="number" inputMode="decimal" min="0" step="0.01"
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="No target"
            />
          </div>
          <div style={{ width: 118 }}>
            <label className="modal-lbl">Or drop of</label>
            <div style={{ position: 'relative' }}>
              <input
                className="modal-input"
                type="number" inputMode="numeric" min="1" max="99" step="1"
                style={{ paddingRight: 26 }}
                value={drop}
                onChange={e => setDrop(e.target.value)}
                placeholder="Off"
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)', pointerEvents: 'none' }}>%</span>
            </div>
          </div>
        </div>

        <div className="modal-ftr">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            {isEdit ? 'Save' : 'Track it'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ProbeStatus({ probing, probe }) {
  const base = { fontSize: 11, marginBottom: 12, minHeight: 16, display: 'flex', alignItems: 'center', gap: 6 };

  if (probing) return (
    <div style={{ ...base, color: 'var(--text3)' }}>
      <IconLoader2 size={12} className={s.spin} /> Reading the page…
    </div>
  );
  if (!probe) return <div style={{ ...base }} />;
  if (!probe.ok) return (
    <div style={{ ...base, color: 'var(--amber)' }}>
      Couldn&apos;t read this page — you can still track it and enter prices yourself.
    </div>
  );
  if (probe.price == null) return (
    <div style={{ ...base, color: 'var(--amber)' }}>
      Page loaded but no price found — you&apos;ll need to enter it yourself.
    </div>
  );
  return (
    <div style={{ ...base, color: 'var(--green)' }}>
      Found ${probe.price.toFixed(2)}{probe.store ? ` at ${probe.store}` : ''}
    </div>
  );
}
