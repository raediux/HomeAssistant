import { createContext, useContext, useEffect, useState } from 'react';
import { getMyHouseholdId, dbLoadMembers, dbLoadTier } from '../db.js';
import { useSession } from './AuthContext.jsx';

const HouseholdContext = createContext(null);

export function HouseholdProvider({ children }) {
  const session = useSession();
  const [household, setHousehold] = useState(null); // { id, members, tier }

  useEffect(() => {
    if (!session) { setHousehold(null); return; }

    async function load() {
      const hid = await getMyHouseholdId();
      if (!hid) { setHousehold({ id: null, members: [], tier: 'free' }); return; }
      const [members, tier] = await Promise.all([dbLoadMembers(), dbLoadTier(hid)]);
      setHousehold({ id: hid, members, tier });
    }

    load();
  }, [session]);

  return <HouseholdContext.Provider value={household}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  return useContext(HouseholdContext);
}
