import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Topbar from '../Topbar/Topbar.jsx';
import TabBar from '../TabBar/TabBar.jsx';
import Tasks from '../Tasks/Tasks.jsx';
import MealPlanner from '../MealPlanner/MealPlanner.jsx';
import Calendar from '../Calendar/Calendar.jsx';
import Prices from '../Prices/Prices.jsx';
import { UndoProvider } from '../../contexts/UndoContext.jsx';
import s from './Dashboard.module.css';

// Lazy: keeps three.js (~600KB) out of the critical bundle — it's only a
// decorative background, so the UI shouldn't wait on it.
const ThreeBackground = lazy(() => import('../shared/ThreeBackground.jsx'));

const TAB_ORDER = ['tasks', 'meals', 'calendar', 'prices'];

const variants = {
  enter: dir => ({ x: dir >= 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit:  dir => ({ x: dir >= 0 ? '-100%' : '100%' }),
};

export default function Dashboard() {
  // tab + slide direction as one state so direction is derived at switch
  // time, not from a ref during render.
  const [nav, setNav] = useState({ tab: 'tasks', dir: 0 });
  const { tab, dir } = nav;

  function handleSwitch(newTab) {
    setNav(prev => ({ tab: newTab, dir: TAB_ORDER.indexOf(newTab) - TAB_ORDER.indexOf(prev.tab) }));
  }

  return (
    <UndoProvider>
    <Suspense fallback={null}><ThreeBackground /></Suspense>
    <div className={s.app}>
      <Topbar />
      <TabBar activeTab={tab} onSwitch={handleSwitch} />
      <div className={s.panelWrap}>
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={tab}
            className={`${s.panel} ${tab === 'meals' ? s.panelNoPad : ''}`}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.18 }}
          >
            {tab === 'tasks'    && <Tasks />}
            {tab === 'meals'    && <MealPlanner />}
            {tab === 'calendar' && <Calendar />}
            {tab === 'prices'   && <Prices />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    </UndoProvider>
  );
}
