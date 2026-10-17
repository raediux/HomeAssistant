import { useEffect, useRef } from 'react';
import { supabase } from '../supabase.js';

// onResync (optional) reloads full state. Changes made while the socket was
// down (phone asleep, PWA backgrounded, network drop) are never replayed, so it
// fires when the page becomes visible, the device comes back online, or the
// channel re-subscribes after its first join.
export function useRealtimeSync(table, onEvent, onResync) {
  const ref = useRef(onEvent);
  const resyncRef = useRef(onResync);
  useEffect(() => { ref.current = onEvent; resyncRef.current = onResync; });

  useEffect(() => {
    let joined = false;
    const resync = () => resyncRef.current?.();
    const channel = supabase
      .channel(`rt_${table}_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table },
        payload => ref.current(payload))
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return;
        if (joined) resync();
        joined = true;
      });
    const onVisible = () => { if (document.visibilityState === 'visible') resync(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', resync);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', resync);
      supabase.removeChannel(channel);
    };
  }, [table]);
}
