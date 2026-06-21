import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Topbar from '../Topbar/Topbar.jsx';
import TabBar from '../TabBar/TabBar.jsx';
import Tasks from '../Tasks/Tasks.jsx';
import MealPlanner from '../MealPlanner/MealPlanner.jsx';
import Calendar from '../Calendar/Calendar.jsx';
import { UndoProvider } from '../../contexts/UndoContext.jsx';
import s from './Dashboard.module.css';

const TAB_ORDER = ['tasks', 'meals', 'calendar'];

const variants = {
  enter: dir => ({ x: dir >= 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit:  dir => ({ x: dir >= 0 ? '-100%' : '100%' }),
};

export default function Dashboard() {
  const [tab, setTab] = useState('tasks');
  const prevIdx = useRef(0);

  function handleSwitch(newTab) {
    prevIdx.current = TAB_ORDER.indexOf(tab);
    setTab(newTab);
  }

  const dir = TAB_ORDER.indexOf(tab) - prevIdx.current;

  return (
    <UndoProvider>
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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    </UndoProvider>
  );
}
