// Static mockup — bypasses framer-motion animation (initial: opacity 0 inside IIFE bundle)
const STORES = ['Aldi', 'Coles', 'Woolworths', 'Big W', 'Chemist Warehouse', 'Others'];

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
      <div className="modal-box">
        <div className="modal-hdr">
          <span>Add Item</span>
          <button className="modal-x">✕</button>
        </div>
        <label className="modal-lbl">Item</label>
        <input className="modal-input" placeholder="Item name" defaultValue="" readOnly style={{ marginBottom: 14 }} />
        <label className="modal-lbl">Store</label>
        <select className="modal-input" defaultValue="Coles" style={{ cursor: 'pointer' }}>
          {STORES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="modal-ftr">
          <button className="btn">Cancel</button>
          <button className="btn btn-primary">Add</button>
        </div>
      </div>
    </div>
  );
}

export function EditItem() {
  return (
    <div style={wrap}>
      <div className="modal-box">
        <div className="modal-hdr">
          <span>Edit Item</span>
          <button className="modal-x">✕</button>
        </div>
        <label className="modal-lbl">Item</label>
        <input className="modal-input" defaultValue="Milk" readOnly style={{ marginBottom: 14 }} />
        <label className="modal-lbl">Store</label>
        <select className="modal-input" defaultValue="Coles" style={{ cursor: 'pointer' }}>
          {STORES.map(s => <option key={s} selected={s === 'Coles'}>{s}</option>)}
        </select>
        <div className="modal-ftr">
          <button className="btn">Cancel</button>
          <button className="btn btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}
