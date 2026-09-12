import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { IconX } from '@tabler/icons-react';
import { FREQ_LABEL as FREQ_LABELS } from '../../config/tasks.js';
import { toDateStr } from './taskUtils.js';

const SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.9 };

const DOW_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function TaskModal({ modal, memberName, onConfirm, onClose }) {
  // Mounted fresh per open (rendered conditionally), so initializers suffice.
  const [title, setTitle] = useState(modal?.task?.title || '');
  const [dueDate, setDueDate] = useState(modal?.task?.dueDate || '');
  const [dow, setDow] = useState(modal?.task?.dow ?? null);
  const [repeatOn, setRepeatOn] = useState(!!modal?.task?.repeatInterval);
  const [repeatEvery, setRepeatEvery] = useState(String(modal?.task?.repeatInterval || 2));

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!modal) return null;

  const repeats = modal?.frequency === 'occasional' && repeatOn;

  function handleConfirm() {
    const t = title.trim();
    if (!t) return;
    const every = Math.min(52, Math.max(1, parseInt(repeatEvery, 10) || 1));
    // A repeat needs an anchor to count from, so an empty date becomes today.
    const due = repeats ? (dueDate || toDateStr(new Date())) : (dueDate || null);
    onConfirm({ title: t, dueDate: due, dow, repeatInterval: repeats ? every : null });
  }

  const isAdd = modal.mode === 'add';
  const heading = isAdd
    ? `Add ${FREQ_LABELS[modal.frequency]} task — ${memberName}`
    : 'Edit task';

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="modal-box" initial={{ scale: 0.88, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.88, y: 16, opacity: 0 }} transition={SPRING}>
        <div className="modal-hdr">
          <span>{heading}</span>
          <button className="modal-x" onClick={onClose}><IconX size={18} /></button>
        </div>

        <label className="modal-lbl">Task</label>
        <input
          autoFocus
          className="modal-input"
          style={{ marginBottom: 12 }}
          maxLength={200}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
          placeholder="Task title"
        />

        {modal.frequency === 'occasional' && (
          <>
            <label className="modal-lbl">{repeats ? 'Next due' : 'Due date (optional)'}</label>
            <input
              type="date"
              className="modal-input"
              style={{ marginBottom: 12 }}
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />

            <label className="modal-lbl">Repeat</label>
            <div className="dow-grid" style={{ marginBottom: 12, alignItems: 'center' }}>
              <button
                type="button"
                className={`dow-btn${!repeatOn ? ' selected' : ''}`}
                onClick={() => setRepeatOn(false)}
              >Never</button>
              <button
                type="button"
                className={`dow-btn${repeatOn ? ' selected' : ''}`}
                onClick={() => setRepeatOn(true)}
              >Every…</button>
              {repeatOn && (
                <>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    className="modal-input"
                    style={{ width: 64, flex: '0 0 auto', textAlign: 'center', padding: '7px 4px' }}
                    value={repeatEvery}
                    onChange={e => setRepeatEvery(e.target.value)}
                  />
                  <span style={{ flex: '0 0 auto', fontSize: 12, color: 'var(--text2)' }}>
                    {Number(repeatEvery) === 1 ? 'week' : 'weeks'}
                  </span>
                </>
              )}
            </div>
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
      </motion.div>
    </div>
  );
}
