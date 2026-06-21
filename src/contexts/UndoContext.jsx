import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const UndoContext = createContext(null);

export function UndoProvider({ children }) {
  const [toast, setToast] = useState(null); // { label }
  const timerRef  = useRef(null);
  const pendingFn = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    if (pendingFn.current) { pendingFn.current(); pendingFn.current = null; }
    setToast(null);
  }, []);

  const scheduleDelete = useCallback((label, deleteFn) => {
    flush();
    pendingFn.current = deleteFn;
    setToast({ label });
    timerRef.current = setTimeout(() => {
      pendingFn.current?.();
      pendingFn.current = null;
      setToast(null);
    }, 5000);
  }, [flush]);

  const undo = useCallback(() => {
    clearTimeout(timerRef.current);
    pendingFn.current = null;
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
      </AnimatePresence>
    </UndoContext.Provider>
  );
}

export function useUndo() {
  return useContext(UndoContext);
}
