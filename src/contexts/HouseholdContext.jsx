import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getMyHouseholdId, dbLoadMembers, dbLoadTier } from '../db.js';
import { useSession } from './AuthContext.jsx';

// Default applies ONLY when no <HouseholdProvider> is mounted (e.g. design-tool
// thumbnail rendering of a bare component). The real app always wraps in the
// provider, whose value= overrides this default, so live loading behaviour is
// unchanged. Mock members let context-dependent components render standalone.
export const HouseholdContext = createContext({
  id: 'preview',
  members: [
    { id: '1', name: 'Ray', slug: 'ray', color: '#4a8fd4' },
    { id: '2', name: 'Jazelle', slug: 'jazelle', color: '#c46090' },
    { id: '3', name: 'Linus', slug: 'linus', color: '#c9a838' },
  ],
  tier: 'pro',
  features: ['whiteboard'],
});

export function HouseholdProvider({ children }) {
  const session = useSession();
  const [household, setHousehold] = useState(null); // { id, members, tier, features }
  const loadedUserId = useRef(null);

  useEffect(() => {
    const userId = session?.user?.id ?? null;

    if (!session) {
      loadedUserId.current = null;
      setHousehold(null);
      return;
    }

    // Supabase fires onAuthStateChange on token refresh and tab focus, not just
    // login. Only reload the household when the actual user changes — otherwise
    // a transient refetch can briefly blank feature-gated UI (e.g. whiteboard).
    if (userId === loadedUserId.current) return;
    loadedUserId.current = userId;

    async function load() {
      const hid = await getMyHouseholdId();
      if (!hid) { setHousehold({ id: null, members: [], tier: 'free', features: [] }); return; }
      const [members, tierData] = await Promise.all([dbLoadMembers(), dbLoadTier(hid)]);
      setHousehold(prev => ({
        id: hid,
        members,
        tier: tierData?.tier ?? prev?.tier ?? 'free',
        features: tierData?.features ?? prev?.features ?? [],
      }));
    }

    load();
  }, [session]);

  return <HouseholdContext.Provider value={household}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  return useContext(HouseholdContext);
}
