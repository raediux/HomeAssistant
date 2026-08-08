import { useEffect, useRef, useState } from 'react';
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
  const [variant, setVariant] = useState(editItem?.variant || '');
  const [probing, setProbing] = useState(false);
  const [probe,  setProbe]  = useState(null);
  const probedUrl = useRef('');

  const variants = probe?.variants || null;
  // Prices come back with the option list, so switching size needs no second fetch.
  const variantPrice = variants?.find(v => v.label === variant)?.price ?? null;
  const needsVariant = !!variants?.length && !variant;

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
      // Keep an already-chosen size only if the page still offers it.
      if (result.variants?.length) {
        setVariant(prev => result.variants.some(v => v.label === prev) ? prev : '');
      }
    }
  }

  // Opening an existing item re-reads its page, so the size list is there to
  // change — and so items saved before size tracking existed can be given one.
  // Deferred past the commit: the probe flips state, which an effect body may
  // not do synchronously.
  useEffect(() => {
    if (!url) return;
    const t = setTimeout(() => runProbe(url), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfirm() {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) { urlRef.current?.focus(); return; }
    // Without a size the daily check has nothing specific to follow, and any
    // number it recorded would belong to whichever option the page listed first.
    if (needsVariant) return;
    const targetNum = target === '' ? null : Number(target);
    const dropNum   = drop  === '' ? null : Number(drop);
    onConfirm({
      url: u,
      name: name.trim() || probe?.title?.slice(0, 90) || u,
      variant: variant || null,
      target_price: Number.isFinite(targetNum) ? targetNum : null,
      drop_pct: Number.isFinite(dropNum) ? dropNum : null,
      // Only seed from the probe on create — editing must not overwrite tracked history.
      probe: isEdit ? null : probe,
      variantPrice,
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

        <ProbeStatus probing={probing} probe={probe} variant={variant} variantPrice={variantPrice} />

        {variants?.length > 0 && (
          <>
            <label className="modal-lbl">Size / option</label>
            <select
              className="modal-input"
              style={{ marginBottom: 12 }}
              value={variant}
              onChange={e => setVariant(e.target.value)}
            >
              <option value="">Choose one…</option>
              {variants.map(v => (
                <option key={v.label} value={v.label}>{v.label} — ${v.price.toFixed(2)}</option>
              ))}
            </select>
          </>
        )}

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
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={needsVariant}
            style={needsVariant ? { opacity: 0.45, cursor: 'default' } : undefined}
          >
            {isEdit ? 'Save' : 'Track it'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ProbeStatus({ probing, probe, variant, variantPrice }) {
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
  // A page with options has no single price to report — the size picker below
  // carries the numbers instead.
  if (probe.variants?.length) return (
    <div style={{ ...base, color: variantPrice != null ? 'var(--green)' : 'var(--text3)' }}>
      {variantPrice != null
        ? `${variant} — $${variantPrice.toFixed(2)}${probe.store ? ` at ${probe.store}` : ''}`
        : `${probe.variants.length} options found — pick the one you want`}
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
