import { useShop } from '../../contexts/ShoppingContext.jsx';
import ShoppingWorkingPanel from './ShoppingWorkingPanel.jsx';
import ShoppingPastPanel from './ShoppingPastPanel.jsx';
import ShoppingModal from './ShoppingModal.jsx';
import { IconPlus } from '@tabler/icons-react';
import s from './Shopping.module.css';

export default function Shopping({ embedded = false }) {
  const shopData = useShop();

  return (
    <div className={s.panel}>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Shopping</span>
          <button className={s.addBtn} onClick={() => shopData.setModal({ editItem: null, defaultStore: null })}>
            <IconPlus size={13} /> Add item
          </button>
        </div>
      )}

      <div className={s.panels} style={embedded ? { marginTop: 0, borderRadius: 0, border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', flex: 1, minHeight: 0 } : {}}>
        <ShoppingWorkingPanel shopData={shopData} />
        <ShoppingPastPanel shopData={shopData} />
      </div>

      {shopData.modal && (
        <ShoppingModal
          editItem={shopData.modal.editItem}
          defaultStore={shopData.modal.defaultStore}
          pastItems={shopData.past}
          onConfirm={shopData.handleModalConfirm}
          onClose={() => shopData.setModal(null)}
        />
      )}
    </div>
  );
}
