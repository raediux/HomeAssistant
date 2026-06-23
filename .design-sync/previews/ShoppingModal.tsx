import { ShoppingModal } from 'home-assistant-react';

const past = [
  { id: 1, name: 'Milk', store: 'Coles', times: 8, category: 'Dairy' },
  { id: 2, name: 'Bread', store: 'Woolworths', times: 6, category: 'Bakery' },
  { id: 3, name: 'Eggs', store: 'Aldi', times: 5, category: 'Dairy' },
  { id: 4, name: 'Chicken', store: 'Coles', times: 4, category: 'Meat' },
];

const wrap = {
  minHeight: 400,
  background: '#111110',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export function AddItem() {
  return (
    <div style={wrap}>
      <ShoppingModal editItem={null} defaultStore="Coles" pastItems={past} onConfirm={() => {}} onClose={() => {}} />
    </div>
  );
}

export function EditItem() {
  return (
    <div style={wrap}>
      <ShoppingModal
        editItem={{ id: 1, name: 'Milk', qty: '2L', store: 'Coles', got: false }}
        defaultStore="Coles"
        pastItems={past}
        onConfirm={() => {}}
        onClose={() => {}}
      />
    </div>
  );
}
