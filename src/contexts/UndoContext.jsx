import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { setDbErrorHandler } from '../db.js';

// Default applies only outside any <UndoProvider> (e.g. design-tool thumbnail
// render of a bare Shopping component); the real app's provider overrides it.
export const UndoContext = createContext({ scheduleDelete: () => {} });

export function UndoProvider({ children }) {
  const [toast, setToast] = useState(null); // { label }
  const [errToast, setErrToast] = useState(null); // string
  const timerRef   = useRef(null);
  const errTimer   = useRef(null);
  const restoreRef = useRef(null);

  // Surface failed DB writes — the UI updates optimistically, so without
  // this a save that fails (e.g. offline) disappears silently.
  useEffect(() => {
    setDbErrorHandler(() => {
      clearTimeout(errTimer.current);
      setErrToast('Couldn’t sync — check your connection');
      errTimer.current = setTimeout(() => setErrToast(null), 4000);
    });
    return () => { setDbErrorHandler(null); clearTimeout(errTimer.current); };
  }, []);

  // The delete hits the DB straight away and Undo re-inserts, rather than
  // deferring the write behind the toast — a deferred write is lost if the tab
  // closes or a phone backgrounds the PWA inside the undo window, which left
  // the row alive in Supabase and made deleted items reappear on next load.
  const scheduleDelete = useCallback((label, deleteFn, restoreFn) => {
    clearTimeout(timerRef.current);
    deleteFn();
    restoreRef.current = restoreFn;
    setToast({ label });
    timerRef.current = setTimeout(() => {
      restoreRef.current = null;
      setToast(null);
    }, 5000);
  }, []);

  const undo = useCallback(() => {
    clearTimeout(timerRef.current);
    restoreRef.current?.();
    restoreRef.current = null;
    setToast(null);
  }, []);

  return (
    <UndoContext.Provider value={{ scheduleDelete }}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="undo-toast"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(30,30,36,0.96)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '10px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              color: 'var(--text)', fontSize: 13, zIndex: 9999,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{toast.label}</span>
            <button
              onClick={undo}
              style={{
                background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Undo
            </button>
          </motion.div>
        )}
        {errToast && (
          <motion.div
            key="err-toast"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed', bottom: toast ? 74 : 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(40,24,26,0.96)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(224,85,85,0.35)',
              borderRadius: 10, padding: '10px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              color: '#e88', fontSize: 13, zIndex: 9999,
              whiteSpace: 'nowrap',
            }}
          >
            {errToast}
          </motion.div>
        )}
      </AnimatePresence>
    </UndoContext.Provider>
  );
}

export function useUndo() {
  return useContext(UndoContext);
}
