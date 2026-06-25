import { createContext, useContext, useEffect, useState } from 'react';
import { dbLoadTasks } from '../db.js';
import { useRealtimeSync } from '../hooks/useRealtimeSync.js';

const TasksContext = createContext(null);

function mapRow(row) {
  return { id: row.id, person: row.person, frequency: row.frequency, title: row.title, dueDate: row.due_date, dow: row.dow, done: row.done, lastDoneDate: row.last_done_date || null };
}

export function TasksProvider({ children }) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => { dbLoadTasks().then(setTasks); }, []);

  useRealtimeSync('tasks', ({ eventType, new: row, old }) => {
    if (eventType === 'DELETE') {
      setTasks(prev => prev.filter(t => t.id !== old.id));
    } else {
      const task = mapRow(row);
      setTasks(prev => prev.some(t => t.id === task.id) ? prev.map(t => t.id === task.id ? task : t) : [...prev, task]);
    }
  });

  return <TasksContext.Provider value={{ tasks, setTasks }}>{children}</TasksContext.Provider>;
}

export function useTasksData() { return useContext(TasksContext); }
