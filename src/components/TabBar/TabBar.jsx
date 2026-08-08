import { APP_VERSION } from '../../version.js';
import { usePrices } from '../../contexts/PricesContext.jsx';
import s from './TabBar.module.css';

const TABS = [
  { id: 'tasks',    label: 'Tasks' },
  { id: 'meals',    label: 'Meal Planner' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'prices',   label: 'Prices' },
];

export default function TabBar({ activeTab, onSwitch }) {
  // Optional: the design tool renders TabBar outside the app's providers.
  const unseen = usePrices()?.unseenCount ?? 0;

  return (
    <div className={s.tabBar}>
      {TABS.map(t => (
        <button
          key={t.id}
          className={`${s.tab} ${activeTab === t.id ? s.active : ''}`}
          onClick={() => onSwitch(t.id)}
        >
          {t.label}
          {t.id === 'prices' && unseen > 0 && <span className={s.dot} />}
        </button>
      ))}
      <span className={s.version} onClick={() => window.location.reload(true)}>v{APP_VERSION}</span>
    </div>
  );
}
