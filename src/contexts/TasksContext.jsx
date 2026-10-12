import { createContext, useContext, useEffect, useState } from 'react';
import { dbLoadTasks, mapTaskRow } from '../db.js';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';
import { isDeleted } from '../utils/tombstones.js';

const TasksContext = createContext(null);

export function TasksProvider({ children }) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => { dbLoadTasks().then(setTasks); }, []);

  useRealtimeSync('tasks', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setTasks(prev => prev.filter(t => t.id !== old.id));
    } else {
      if (isDeleted(row.id)) return;
      const task = mapTaskRow(row);
      setTasks(prev => prev.some(t => t.id === task.id) ? prev.map(t => t.id === task.id ? task : t) : [...prev, task]);
    }
  });

  return <TasksContext.Provider value={{ tasks, setTasks }}>{children}</TasksContext.Provider>;
}

export function useTasksData() { return useContext(TasksContext); }
