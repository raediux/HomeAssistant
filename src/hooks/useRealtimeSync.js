import { useEffect, useRef } from 'react';
import { supabase } from '../supabase.js';

export function useRealtimeSync(table, onEvent) {
  const ref = useRef(onEvent);
  useEffect(() => { ref.current = onEvent; });

  useEffect(() => {
    const channel = supabase
      .channel(`rt_${table}_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table },
        payload => ref.current(payload))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [table]);
}
