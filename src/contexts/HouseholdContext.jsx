import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getMyHouseholdId, dbLoadMembers, dbLoadTier } from '../db.js';
import { useSession } from './AuthContext.jsx';
import { memberAccent } from '../config/members.js';
import { memberSlug } from '../utils.js';

function enrichMember(m) {
  const acc = memberAccent(m.name);
  const color = m.color ?? acc.color;
  return { ...m, slug: m.slug ?? memberSlug(m.name), color, glow: acc.glow, tint: acc.tint, shadow: acc.shadow, sharesMeals: !!m.shares_meals };
}

// Default applies ONLY when no <HouseholdProvider> is mounted (e.g. design-tool
// thumbnail rendering of a bare component). The real app always wraps in the
// provider, whose value= overrides this default, so live loading behaviour is
// unchanged. Mock members let context-dependent components render standalone.
export const HouseholdContext = createContext({
  id: 'preview',
  members: [
    { id: '1', name: 'Ray',     slug: 'ray',     color: '#4a8fd4', glow: 'rgba(74,143,212,0.22)',  tint: 'rgba(74,143,212,0.05)',  shadow: 'rgba(74,143,212,0.18)' },
    { id: '2', name: 'Jazelle', slug: 'jazelle', color: '#c46090', glow: 'rgba(196,96,144,0.15)',  tint: 'rgba(196,96,144,0.04)',  shadow: 'rgba(196,96,144,0.14)' },
    { id: '3', name: 'Linus',   slug: 'linus',   color: '#c9a838', glow: 'rgba(201,168,56,0.11)',  tint: 'rgba(201,168,56,0.04)',  shadow: 'rgba(201,168,56,0.12)' },
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
      const [rawMembers, tierData] = await Promise.all([dbLoadMembers(), dbLoadTier(hid)]);
      const members = rawMembers.map(enrichMember);
      setHousehold(prev => ({
        id: hid,
        members,
        tier: tierData?.tier ?? prev?.tier ?? 'free',
        features: tierData?.features ?? prev?.features ?? [],
      }));
    }

    load();
  }, [session]);

  function setMemberColor(memberId, color) {
    setHousehold(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === memberId ? enrichMember({ ...m, color }) : m),
    }));
  }

  function setMemberSharesMeals(memberId, value) {
    setHousehold(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === memberId ? enrichMember({ ...m, shares_meals: value }) : m),
    }));
  }

  return <HouseholdContext.Provider value={household ? { ...household, setMemberColor, setMemberSharesMeals } : null}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  return useContext(HouseholdContext);
}
