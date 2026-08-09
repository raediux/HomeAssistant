import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IconPlus, IconRefresh, IconLoader2, IconTag, IconX } from '@tabler/icons-react';
import { usePrices } from '../../contexts/PricesContext.jsx';
import { useUndo } from '../../contexts/UndoContext.jsx';
import { newId } from '../../utils.js';
import {
  dbSavePriceItem, dbPatchPriceItem, dbDeletePriceItem,
  dbSavePriceSource, dbPatchPriceSource, dbDeletePriceSource,
  dbSeedPriceHistory,
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

  // Turn a form link into a price_sources row. A link added from a successful
  // probe is stamped as just-checked so it counts toward the cheapest price
  // straight away instead of waiting for the overnight run.
  function sourceRow(link, itemId, index) {
    const now = new Date().toISOString();
    return {
      id: link.id ?? newId() + index,
      item_id: itemId,
      url: link.url,
      store: link.store ?? null,
      variant: link.variant ?? null,
      image_url: link.image ?? null,
      current_price: link.price ?? null,
      lowest_price: link.price ?? null,
      manual: false,
      sort_order: index,
      last_checked_at: link.price != null ? now : null,
      last_ok_at: link.price != null ? now : null,
      last_status: link.price != null ? 'ok' : null,
    };
  }

  function bestOf(rows) {
    const prices = rows.map(r => r.current_price).filter(p => p != null);
    return prices.length ? Math.min(...prices) : null;
  }

  function handleConfirm(form) {
    if (modal?.edit) {
      const item = modal.edit;
      const rows = form.links.map((l, i) => sourceRow(l, item.id, i));
      const kept = new Set(rows.map(r => r.id));
      const removed = (item.sources ?? []).filter(sc => !kept.has(sc.id));

      const best = bestOf(rows);
      const patch = {
        name: form.name,
        target_price: form.target_price,
        drop_pct: form.drop_pct,
        ...(best != null ? { current_price: best } : {}),
      };
      upsertLocal({ ...item, ...patch, sources: rows });
      dbPatchPriceItem(item.id, patch);
      rows.forEach(dbSavePriceSource);
      removed.forEach(sc => dbDeletePriceSource(sc.id));
    } else {
      const itemId = newId();
      const rows = form.links.map((l, i) => sourceRow(l, itemId, i));
      const best = bestOf(rows);
      const row = {
        id: itemId,
        name: form.name,
        image_url: rows.find(r => r.image_url)?.image_url ?? null,
        current_price: best, previous_price: null,
        lowest_price: best, highest_price: best,
        target_price: form.target_price, drop_pct: form.drop_pct,
        on_sale: best != null && form.target_price != null && best <= form.target_price,
        seen: true,
        best_source_id: rows.find(r => r.current_price === best)?.id ?? null,
        sort_order: 0,
        sources: rows,
      };
      upsertLocal(row);
      dbSavePriceItem(row);
      rows.forEach(dbSavePriceSource);
      // Opening point, so an item whose price never moves still has a chart.
      dbSeedPriceHistory(itemId, best);
    }
    setModal(null);
  }

  function handleDelete(item) {
    setItems(prev => prev.filter(i => i.id !== item.id));
    scheduleDelete(
      `Removed "${item.name}"`,
      () => dbDeletePriceItem(item.id),
      // Deleting the product cascades its links away, so undo has to put them
      // back too — and only once the product row exists again, since they key
      // off it. Restoring the product alone would leave a card with no shops.
      async () => {
        upsertLocal(item);
        await dbSavePriceItem(item);
        await Promise.all((item.sources ?? []).map(dbSavePriceSource));
      },
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

    // The price belongs to a shop, not the product, so it lands on the link the
    // card is quoting. `manual` stays false so we keep retrying the page — a
    // site that blocks us today may not tomorrow.
    const sources = item.sources ?? [];
    const target = sources.find(sc => sc.id === item.best_source_id) ?? sources[0];
    if (!target) { setManual(null); return; }

    const now = new Date().toISOString();
    const srcPatch = {
      current_price: price,
      previous_price: target.current_price ?? null,
      lowest_price: target.lowest_price == null ? price : Math.min(Number(target.lowest_price), price),
      last_checked_at: now, last_ok_at: now,
      last_status: 'ok', last_error: null,
    };
    const nextSources = sources.map(sc => sc.id === target.id ? { ...sc, ...srcPatch } : sc);
    const best = Math.min(...nextSources.map(sc => sc.current_price).filter(p => p != null).map(Number));

    const itemPatch = {
      current_price: best,
      previous_price: item.current_price ?? null,
      lowest_price:  item.lowest_price  == null ? best : Math.min(Number(item.lowest_price), best),
      highest_price: item.highest_price == null ? best : Math.max(Number(item.highest_price), best),
      best_source_id: nextSources.find(sc => Number(sc.current_price) === best)?.id ?? target.id,
    };

    upsertLocal({ ...item, ...itemPatch, sources: nextSources });
    dbPatchPriceSource(target.id, srcPatch);
    dbPatchPriceItem(item.id, itemPatch);
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
