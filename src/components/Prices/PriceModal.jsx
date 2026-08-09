import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { IconX, IconLoader2, IconPlus, IconTrash } from '@tabler/icons-react';
import { dbProbeUrl } from '../../db.js';
import s from './Prices.module.css';

const SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.9 };

let tempId = -1;
const blankLink = () => ({
  key: tempId--, id: null, url: '', store: null, variant: '',
  variants: null, probe: null, probing: false, price: null, image: null,
});

function linkFromSource(src) {
  return {
    key: src.id, id: src.id, url: src.url, store: src.store, variant: src.variant || '',
    variants: null, probe: null, probing: false,
    price: src.current_price == null ? null : Number(src.current_price),
    image: src.image_url,
  };
}

export default function PriceModal({ editItem, onConfirm, onClose }) {
  const isEdit = !!editItem;
  // Mounted fresh per open (rendered conditionally), so initializers suffice.
  const [name,   setName]   = useState(editItem?.name || '');
  const [target, setTarget] = useState(editItem?.target_price ?? '');
  const [drop,   setDrop]   = useState(editItem?.drop_pct ?? 5);
  const [links,  setLinks]  = useState(() =>
    editItem?.sources?.length ? editItem.sources.map(linkFromSource) : [blankLink()]
  );
  const probed = useRef(new Set());

  function updateLink(key, patch) {
    setLinks(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  }

  // Read a retailer page once per URL, so name, picture, size options and the
  // current price are known before anything is saved.
  async function runProbe(key, value) {
    const url = value.trim();
    if (!/^https?:\/\//i.test(url) || probed.current.has(url)) return;
    probed.current.add(url);
    updateLink(key, { probing: true });
    const result = await dbProbeUrl(url);
    setLinks(prev => prev.map(l => {
      if (l.key !== key) return l;
      const variants = result?.ok ? result.variants ?? null : null;
      return {
        ...l,
        probing: false,
        probe: result,
        variants,
        store: result?.ok ? result.store ?? l.store : l.store,
        image: result?.ok ? result.image ?? l.image : l.image,
        // Keep an already-chosen size only if this page still offers it.
        variant: variants?.some(v => v.label === l.variant) ? l.variant : (variants ? '' : l.variant),
        price: result?.ok ? result.price ?? l.price : l.price,
      };
    }));
    if (result?.ok && result.title) setName(prev => prev.trim() || result.title.slice(0, 90));
  }

  // Opening an existing item re-reads its pages, so size lists are available to
  // change and items saved before a feature existed can be brought up to date.
  // Deferred past commit: probing flips state, which an effect body may not do
  // synchronously.
  useEffect(() => {
    const t = setTimeout(() => {
      links.forEach(l => { if (l.url) runProbe(l.key, l.url); });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filled = links.filter(l => l.url.trim());
  // A page with size options has no single price, so saving without a choice
  // would record whichever option the page happened to list first.
  const needsVariant = links.some(l => l.variants?.length && !l.variant);
  const canSave = filled.length > 0 && !needsVariant;

  function priceOf(link) {
    if (link.variants?.length) return link.variants.find(v => v.label === link.variant)?.price ?? null;
    return link.price;
  }

  function handleConfirm() {
    if (!canSave) return;
    const targetNum = target === '' ? null : Number(target);
    const dropNum   = drop  === '' ? null : Number(drop);
    onConfirm({
      name: name.trim() || filled[0].url,
      target_price: Number.isFinite(targetNum) ? targetNum : null,
      drop_pct: Number.isFinite(dropNum) ? dropNum : null,
      links: filled.map(l => ({
        id: l.id,
        url: l.url.trim(),
        store: l.store,
        variant: l.variant || null,
        image: l.image,
        price: priceOf(l),
      })),
    });
  }

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        className="modal-box"
        style={{ width: 440 }}
        initial={{ scale: 0.88, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 16, opacity: 0 }}
        transition={SPRING}
      >
        <div className="modal-hdr">
          <span>{isEdit ? 'Edit item' : 'Track a price'}</span>
          <button className="modal-x" onClick={onClose}><IconX size={18} /></button>
        </div>

        <label className="modal-lbl">
          {links.length > 1 ? 'Retailers' : 'Product link'}
        </label>
        <div className={s.linkList}>
          {links.map((link, i) => (
            <LinkRow
              key={link.key}
              link={link}
              autoFocus={!isEdit && i === 0}
              canRemove={links.length > 1}
              onChange={patch => updateLink(link.key, patch)}
              onProbe={value => runProbe(link.key, value)}
              onRemove={() => setLinks(prev => prev.filter(l => l.key !== link.key))}
            />
          ))}
        </div>

        <button className={s.addLinkBtn} onClick={() => setLinks(prev => [...prev, blankLink()])}>
          <IconPlus size={12} /> Add another retailer
        </button>

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
              <span className={s.pctSuffix}>%</span>
            </div>
          </div>
        </div>

        {links.length > 1 && (
          <p className={s.modalNote}>
            Alerts use the cheapest of these, so you&apos;re told when the best price you
            could actually pay changes.
          </p>
        )}

        <div className="modal-ftr">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!canSave}
            style={!canSave ? { opacity: 0.45, cursor: 'default' } : undefined}
          >
            {isEdit ? 'Save' : 'Track it'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LinkRow({ link, autoFocus, canRemove, onChange, onProbe, onRemove }) {
  const variantPrice = link.variants?.find(v => v.label === link.variant)?.price ?? null;

  return (
    <div className={s.linkRow}>
      <div className={s.linkTop}>
        <input
          autoFocus={autoFocus}
          className="modal-input"
          value={link.url}
          onChange={e => onChange({ url: e.target.value })}
          onBlur={e => onProbe(e.target.value)}
          onPaste={e => {
            const pasted = e.clipboardData.getData('text');
            if (pasted) setTimeout(() => onProbe(pasted), 0);
          }}
          onKeyDown={e => { if (e.key === 'Enter') onProbe(e.currentTarget.value); }}
          placeholder="https://www.jbhifi.com.au/products/…"
          autoComplete="off"
          spellCheck="false"
        />
        {canRemove && (
          <button className={s.linkRemove} onClick={onRemove} title="Remove this retailer">
            <IconTrash size={13} />
          </button>
        )}
      </div>

      {link.variants?.length > 0 && (
        <select
          className="modal-input"
          value={link.variant}
          onChange={e => onChange({ variant: e.target.value })}
        >
          <option value="">Choose a size / option…</option>
          {link.variants.map(v => (
            <option key={v.label} value={v.label}>{v.label} — ${v.price.toFixed(2)}</option>
          ))}
        </select>
      )}

      <ProbeStatus link={link} variantPrice={variantPrice} />
    </div>
  );
}

function ProbeStatus({ link, variantPrice }) {
  const { probing, probe, variant } = link;

  if (probing) return (
    <div className={s.probeLine} style={{ color: 'var(--text3)' }}>
      <IconLoader2 size={12} className={s.spin} /> Reading the page…
    </div>
  );
  if (!probe) return <div className={s.probeLine} />;
  if (!probe.ok) return (
    <div className={s.probeLine} style={{ color: 'var(--amber)' }}>
      Couldn&apos;t read this page — you can still track it and enter prices yourself.
    </div>
  );
  // A page with options has no single price to report; the picker carries them.
  if (probe.variants?.length) return (
    <div className={s.probeLine} style={{ color: variantPrice != null ? 'var(--green)' : 'var(--text3)' }}>
      {variantPrice != null
        ? `${variant} — $${variantPrice.toFixed(2)}${probe.store ? ` at ${probe.store}` : ''}`
        : `${probe.variants.length} options found — pick the one you want`}
    </div>
  );
  if (probe.price == null) return (
    <div className={s.probeLine} style={{ color: 'var(--amber)' }}>
      {probe.reason || 'Page loaded but no price found — you’ll need to enter it yourself.'}
    </div>
  );
  return (
    <div className={s.probeLine} style={{ color: 'var(--green)' }}>
      Found ${probe.price.toFixed(2)}{probe.store ? ` at ${probe.store}` : ''}
    </div>
  );
}
