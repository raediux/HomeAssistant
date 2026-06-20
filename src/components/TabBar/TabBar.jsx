import { APP_VERSION } from '../../version.js';
import s from './TabBar.module.css';

const TABS = [
  { id: 'tasks',    label: 'Tasks' },
  { id: 'meals',    label: 'Meal Planner' },
  { id: 'calendar', label: 'Calendar' },
];

export default function TabBar({ activeTab, onSwitch }) {
  return (
    <div className={s.tabBar}>
      {TABS.map(t => (
        <button
          key={t.id}
          className={`${s.tab} ${activeTab === t.id ? s.active : ''}`}
          onClick={() => onSwitch(t.id)}
        >
          {t.label}
        </button>
      ))}
      <span className={s.version}>v{APP_VERSION}</span>
    </div>
  );
}
