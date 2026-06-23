import { ShoppingPastPanel } from 'home-assistant-react';
import { MotionConfig } from 'framer-motion';

const past = [
  { id: 1, name: 'Milk', store: 'Coles', times: 8, category: 'Dairy' },
  { id: 2, name: 'Yoghurt', store: 'Coles', times: 5, category: 'Dairy' },
  { id: 3, name: 'Eggs', store: 'Aldi', times: 6, category: 'Dairy' },
  { id: 4, name: 'Bread', store: 'Woolworths', times: 7, category: 'Bakery' },
  { id: 5, name: 'Sourdough', store: 'Woolworths', times: 3, category: 'Bakery' },
  { id: 6, name: 'Chicken thighs', store: 'Coles', times: 4, category: 'Meat' },
];

const mockData = {
  past,
  pastGroups: {
    Coles: past.filter(i => i.store === 'Coles'),
    Aldi: past.filter(i => i.store === 'Aldi'),
    Woolworths: past.filter(i => i.store === 'Woolworths'),
  },
  filteredPast: past,
  collapsedPast: {},
  setCollapsedPast: () => {},
  search: '',
  setSearch: () => {},
  moveToList: () => {},
  deletePastItem: () => {},
};

export function Default() {
  return (
    <MotionConfig reducedMotion="always">
      <div style={{ background: '#111110', minHeight: 400, padding: 16 }}>
        <ShoppingPastPanel shopData={mockData} noWrapper />
      </div>
    </MotionConfig>
  );
}
