import { HouseholdContext } from '../contexts/HouseholdContext.jsx';
import { UndoContext } from '../contexts/UndoContext.jsx';

const MOCK_HOUSEHOLD = {
  id: 'mock',
  members: [
    { id: '1', name: 'Ray', slug: 'ray', color: '#4a8fd4' },
    { id: '2', name: 'Jazelle', slug: 'jazelle', color: '#c46090' },
    { id: '3', name: 'Linus', slug: 'linus', color: '#c9a838' },
  ],
  tier: 'pro',
  features: ['whiteboard'],
};
const MOCK_UNDO = { scheduleDelete: () => {} };

export default function MockProviders({ children }) {
  return (
    <UndoContext.Provider value={MOCK_UNDO}>
      <HouseholdContext.Provider value={MOCK_HOUSEHOLD}>
        {children}
      </HouseholdContext.Provider>
    </UndoContext.Provider>
  );
}
