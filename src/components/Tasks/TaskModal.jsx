import { useEffect, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import s from './Tasks.module.css';

const DOW_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const FREQ_LABELS = { daily: 'Daily', weekly: 'Weekly', occasional: 'Occasional' };

export default function TaskModal({ modal, memberName, onConfirm, onClose }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dow, setDow] = useState(null);
  useEffect(() => {
    if (!modal) return;
    setTitle(modal.task?.title || '');
    setDueDate(modal.task?.dueDate || '');
    setDow(modal.task?.dow ?? null);
  }, [modal]);

  if (!modal) return null;

  function handleConfirm() {
    const t = title.trim();
    if (!t) return;
    onConfirm({ title: t, dueDate: dueDate || null, dow });
  }

  const isAdd = modal.mode === 'add';
  const heading = isAdd
    ? `Add ${FREQ_LABELS[modal.frequency]} task — ${memberName}`
    : 'Edit task';

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-hdr">
          <span>{heading}</span>
          <button className="modal-x" onClick={onClose}><IconX size={18} /></button>
        </div>

        <label className="modal-lbl">Task</label>
        <input
          autoFocus
          className="modal-input"
          style={{ marginBottom: 12 }}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
          placeholder="Task title"
        />

        {modal.frequency === 'occasional' && (
          <>
            <label className="modal-lbl">Due date (optional)</label>
            <input
              type="date"
              className="modal-input"
              style={{ marginBottom: 12 }}
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </>
        )}

        {modal.frequency === 'weekly' && (
          <>
            <label className="modal-lbl">Day of week</label>
            <div className="dow-grid" style={{ marginBottom: 12 }}>
              {DOW_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  className={`dow-btn${dow === i ? ' selected' : ''}`}
                  onClick={() => setDow(dow === i ? null : i)}
                >{label}</button>
              ))}
            </div>
          </>
        )}

        <div className="modal-ftr">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            {isAdd ? 'Add task' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
