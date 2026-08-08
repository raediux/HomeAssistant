import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  IconExternalLink, IconPencil, IconTrash, IconAlertTriangle,
  IconArrowDown, IconArrowUp, IconTargetArrow,
} from '@tabler/icons-react';
import { useTilt } from '../../hooks/useTilt.js';
import { dbLoadPriceHistory } from '../../db.js';
import { cn } from '../../utils.js';
import s from './Prices.module.css';

const money = n => n == null ? '—' : `$${Number(n).toFixed(2)}`;

function relativeTime(iso) {
  if (!iso) return 'never checked';
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 2)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

// Step-shaped, because a price holds its value between checks rather than
// drifting linearly toward the next one.
function Sparkline({ points }) {
  if (points.length < 2) return null;
  const W = 96, H = 26, PAD = 2;
  const values = points.map(p => Number(p.price));
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = i => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = v => H - PAD - ((v - min) / span) * (H - PAD * 2);

  let d = `M ${x(0)} ${y(values[0])}`;
  for (let i = 1; i < values.length; i++) d += ` H ${x(i)} V ${y(values[i])}`;

  const falling = values[values.length - 1] <= values[0];
  return (
    <svg className={s.spark} viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <path d={d} fill="none" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"
        stroke={falling ? 'var(--green)' : 'var(--text3)'} />
    </svg>
  );
}

export default function PriceCard({ item, onEdit, onDelete, onOpen, onManualPrice }) {
  const { ref, rotateX, rotateY, onMouseMove, onMouseLeave } = useTilt(5);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // current_price is the cheap "something moved" signal — refetch the curve only then.
    dbLoadPriceHistory(item.id).then(setHistory);
  }, [item.id, item.current_price]);

  const price   = item.current_price == null ? null : Number(item.current_price);
  const prev    = item.previous_price == null ? null : Number(item.previous_price);
  const delta   = price != null && prev != null ? price - prev : null;
  const deltaPct = delta != null && prev > 0 ? (delta / prev) * 100 : null;
  const failed  = item.last_status && item.last_status !== 'ok';
  const isLowest = price != null && item.lowest_price != null && price <= Number(item.lowest_price);

  return (
    <motion.div
      ref={ref}
      className={cn(s.card, item.on_sale && s.cardSale, item.on_sale && !item.seen && s.cardUnseen)}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={() => onOpen(item)}
      layout
    >
      <div className={s.thumb}>
        {item.image_url
          ? <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
          : <span className={s.thumbFallback}>{(item.store || item.name || '?').slice(0, 1)}</span>}
      </div>

      <div className={s.cardBody}>
        <div className={s.cardTop}>
          <span className={s.cardName} title={item.name}>{item.name}</span>
          <div className={s.cardActions}>
            <a
              className={cn(s.iconBtn, s.open)} href={item.url}
              target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()} title="Open product page"
            ><IconExternalLink size={13} /></a>
            <button className={cn(s.iconBtn, s.edt)} onClick={e => { e.stopPropagation(); onEdit(item); }} title="Edit">
              <IconPencil size={13} />
            </button>
            <button className={cn(s.iconBtn, s.del)} onClick={e => { e.stopPropagation(); onDelete(item); }} title="Remove">
              <IconTrash size={13} />
            </button>
          </div>
        </div>

        <div className={s.cardMeta}>
          {item.store && <span className={s.storeChip}>{item.store}</span>}
          <span className={cn(s.checked, failed && s.checkedFailed)}>
            {failed && <IconAlertTriangle size={10} />}
            {failed ? `couldn't read · ${relativeTime(item.last_checked_at)}` : relativeTime(item.last_checked_at)}
          </span>
        </div>

        <div className={s.priceRow}>
          <span className={cn(s.price, item.on_sale && s.priceSale)}>{money(price)}</span>

          {delta != null && delta !== 0 && (
            <span className={cn(s.delta, delta < 0 ? s.down : s.up)}>
              {delta < 0 ? <IconArrowDown size={11} /> : <IconArrowUp size={11} />}
              {money(Math.abs(delta))}
              {deltaPct != null && ` (${Math.abs(deltaPct).toFixed(0)}%)`}
            </span>
          )}
          {isLowest && history.length > 1 && <span className={s.lowestChip}>lowest yet</span>}

          <Sparkline points={history} />
        </div>

        <div className={s.cardFoot}>
          {item.target_price != null && (
            <span className={s.target}>
              <IconTargetArrow size={11} /> target {money(item.target_price)}
            </span>
          )}
          {item.drop_pct != null && <span className={s.target}>alert on −{item.drop_pct}%</span>}
          {failed && (
            <button
              className={s.manualBtn}
              onClick={e => { e.stopPropagation(); onManualPrice(item); }}
            >Enter price manually</button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
