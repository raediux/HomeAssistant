import { ShoppingWorkingPanel } from 'home-assistant-react';
import { MotionConfig } from 'framer-motion';

const working = [
  { id: 1, name: 'Milk', qty: '2L', store: 'Coles', got: false, sort_order: 0 },
  { id: 2, name: 'Bread', qty: null, store: 'Coles', got: true, sort_order: 1 },
  { id: 3, name: 'Eggs', qty: '12pk', store: 'Aldi', got: false, sort_order: 2 },
  { id: 4, name: 'Chicken thighs', qty: '1kg', store: 'Woolworths', got: false, sort_order: 3 },
  { id: 5, name: 'Pasta', qty: null, store: 'Woolworths', got: false, sort_order: 4 },
];

const mockData = {
  working,
  collapsed: {},
  setCollapsed: () => {},
  modal: null,
  setModal: () => {},
  search: '',
  setSearch: () => {},
  nextId: { current: 100 },
  toggleGot: () => {},
  moveToArchive: () => {},
  deleteWorkingItem: () => {},
  clearAll: () => {},
  workingGroups: {
    Coles: working.filter(i => i.store === 'Coles'),
    Aldi: working.filter(i => i.store === 'Aldi'),
    Woolworths: working.filter(i => i.store === 'Woolworths'),
  },
  past: [],
  pastGroups: {},
  filteredPast: [],
  collapsedPast: {},
  setCollapsedPast: () => {},
  moveToList: () => {},
  deletePastItem: () => {},
  handleModalConfirm: () => {},
};

export function Default() {
  return (
    <MotionConfig reducedMotion="always">
      <div style={{ background: '#111110', minHeight: 400, padding: 16 }}>
        <ShoppingWorkingPanel shopData={mockData} showAddBtn noWrapper />
      </div>
    </MotionConfig>
  );
}
