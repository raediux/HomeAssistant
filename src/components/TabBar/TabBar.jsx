import { motion } from 'framer-motion';
import { useMagnet } from '../../hooks/useMagnet.js';
import { APP_VERSION } from '../../version.js';
import s from './TabBar.module.css';

const TABS = [
  { id: 'tasks',    label: 'Tasks' },
  { id: 'meals',    label: 'Meal Planner' },
  { id: 'calendar', label: 'Calendar' },
];

function MagnetTab({ id, label, active, onClick }) {
  const { ref, x, y, onMouseMove, onMouseLeave } = useMagnet(0.3, 70);
  return (
    <motion.button
      ref={ref}
      className={`${s.tab} ${active ? s.active : ''}`}
      onClick={onClick}
      style={{ x, y }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {label}
    </motion.button>
  );
}

export default function TabBar({ activeTab, onSwitch }) {
  return (
    <div className={s.tabBar}>
      {TABS.map(t => (
        <MagnetTab
          key={t.id}
          id={t.id}
          label={t.label}
          active={activeTab === t.id}
          onClick={() => onSwitch(t.id)}
        />
      ))}
      <span className={s.version} onClick={() => window.location.reload(true)}>v{APP_VERSION}</span>
    </div>
  );
}
