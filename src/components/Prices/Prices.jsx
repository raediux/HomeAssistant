import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IconPlus, IconRefresh, IconLoader2, IconTag, IconX } from '@tabler/icons-react';
import { usePrices } from '../../contexts/PricesContext.jsx';
import { useUndo } from '../../contexts/UndoContext.jsx';
import { newId } from '../../utils.js';
import {
  dbSavePriceItem, dbPatchPriceItem, dbDeletePriceItem,
} from '../../db.js';
import PriceCard from './PriceCard.jsx';
import PriceModal from './PriceModal.jsx';
import s from './Prices.module.css';

const SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.9 };

export default function Prices() {
  const { items, setItems, checking, checkNow, lastRun } = usePrices();
  const { scheduleDelete } = useUndo();
  const [modal, setModal] = useState(null);        // { edit? } for the add/edit form
  const [manual, setManual] = useState(null);      // item awaiting a hand-typed price

  const onSale   = items.filter(i => i.on_sale);
  const watching = items.filter(i => !i.on_sale);
  const lastChecked = items.reduce(
    (acc, i) => (i.last_checked_at && (!acc || i.last_checked_at > acc) ? i.last_checked_at : acc),
    null,
  );

  function upsertLocal(row) {
    setItems(prev => prev.some(i => i.id === row.id) ? prev.map(i => i.id === row.id ? row : i) : [row, ...prev]);
  }

  function handleConfirm(form) {
    if (modal?.edit) {
      const updated = {
        ...modal.edit,
        url: form.url, name: form.name,
        target_price: form.target_price, drop_pct: form.drop_pct,
      };
      upsertLocal(updated);
      dbPatchPriceItem(updated.id, {
        url: form.url, name: form.name,
        target_price: form.target_price, drop_pct: form.drop_pct,
      });
    } else {
      // Seed from the probe so a new card shows a real price immediately rather
      // than sitting blank until the next check.
      const p = form.probe;
      const price = p?.ok ? p.price ?? null : null;
      const row = {
        id: newId(),
        name: form.name, url: form.url,
        store: p?.store ?? null,
        image_url: p?.image ?? null,
        current_price: price, previous_price: null,
        lowest_price: price, highest_price: price,
        target_price: form.target_price, drop_pct: form.drop_pct,
        on_sale: price != null && form.target_price != null && price <= form.target_price,
        seen: true, manual: false, price_regex: null,
        last_checked_at: price != null ? new Date().toISOString() : null,
        last_status: price != null ? 'ok' : null,
        sort_order: 0,
      };
      upsertLocal(row);
      dbSavePriceItem(row);
    }
    setModal(null);
  }

  function handleDelete(item) {
    setItems(prev => prev.filter(i => i.id !== item.id));
    scheduleDelete(
      `Removed "${item.name}"`,
      () => dbDeletePriceItem(item.id),
      () => { upsertLocal(item); dbSavePriceItem(item); },
    );
  }

  // Opening a flagged card is the acknowledgement — it clears the tab dot.
  function handleOpen(item) {
    if (item.on_sale && !item.seen) {
      upsertLocal({ ...item, seen: true });
      dbPatchPriceItem(item.id, { seen: true });
    }
  }

  function saveManualPrice(item, value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) { setManual(null); return; }
    const patch = {
      current_price: price,
      previous_price: item.current_price ?? null,
      lowest_price:  item.lowest_price  == null ? price : Math.min(Number(item.lowest_price), price),
      highest_price: item.highest_price == null ? price : Math.max(Number(item.highest_price), price),
      last_checked_at: new Date().toISOString(),
      last_status: 'ok',
      last_error: null,
    };
    upsertLocal({ ...item, ...patch });
    dbPatchPriceItem(item.id, patch);
    setManual(null);
  }

  const cardProps = {
    onEdit: item => setModal({ edit: item }),
    onDelete: handleDelete,
    onOpen: handleOpen,
    onManualPrice: setManual,
  };

  return (
    <div className={s.panel}>
      <div className={s.hdr}>
        <div>
          <span className={s.title}>Prices</span>
          <span className={s.sub}>
            {items.length === 0 ? 'nothing tracked yet'
              : `${items.length} item${items.length === 1 ? '' : 's'}`}
            {lastChecked && ` · checked ${new Date(lastChecked).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
            {lastRun && ` · ${lastRun.ok}/${lastRun.checked} read`}
          </span>
        </div>
        <div className={s.hdrActions}>
          <button className={s.ghostBtn} onClick={checkNow} disabled={checking || items.length === 0}>
            {checking ? <IconLoader2 size={13} className={s.spin} /> : <IconRefresh size={13} />}
            {checking ? 'Checking…' : 'Check now'}
          </button>
          <button className={s.addBtn} onClick={() => setModal({})}>
            <IconPlus size={13} /> Track item
          </button>
        </div>
      </div>

      <div className={s.scroll}>
        {items.length === 0 && (
          <div className={s.empty}>
            <IconTag size={26} />
            <p>Paste a product link and we&apos;ll watch the price for you.</p>
            <span>Checked automatically every morning.</span>
          </div>
        )}

        {onSale.length > 0 && (
          <section className={s.section}>
            <div className={s.secHdr}>
              <span className={s.secLabel}>On sale</span>
              <span className={s.secLine} />
              <span className={s.secCount}>{onSale.length}</span>
            </div>
            <div className={s.grid}>
              {onSale.map(item => <PriceCard key={item.id} item={item} {...cardProps} />)}
            </div>
          </section>
        )}

        {watching.length > 0 && (
          <section className={s.section}>
            <div className={s.secHdr}>
              <span className={s.secLabel}>Watching</span>
              <span className={s.secLine} />
              <span className={s.secCount}>{watching.length}</span>
            </div>
            <div className={s.grid}>
              {watching.map(item => <PriceCard key={item.id} item={item} {...cardProps} />)}
            </div>
          </section>
        )}
      </div>

      <AnimatePresence>
        {modal && (
          <PriceModal
            key="price-modal"
            editItem={modal.edit}
            onConfirm={handleConfirm}
            onClose={() => setModal(null)}
          />
        )}
        {manual && (
          <ManualPriceModal
            key="manual-modal"
            item={manual}
            onConfirm={value => saveManualPrice(manual, value)}
            onClose={() => setManual(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Fallback for sites that turn our reader away — you read the price, we keep
// the history and the alerting.
function ManualPriceModal({ item, onConfirm, onClose }) {
  const [value, setValue] = useState(item.current_price ?? '');

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
          <span>Enter price</span>
          <button className="modal-x" onClick={onClose}><IconX size={18} /></button>
        </div>
        <p className={s.manualNote}>
          {item.store || 'This site'} wouldn&apos;t let us read the page. Type what it costs now
          and it&apos;ll be recorded like any other check.
        </p>
        <label className="modal-lbl">Price</label>
        <input
          autoFocus
          className="modal-input"
          type="number" inputMode="decimal" min="0" step="0.01"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(value); }}
        />
        <div className="modal-ftr">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm(value)}>Save</button>
        </div>
      </motion.div>
    </div>
  );
}
