// Static mockup — bypasses framer-motion animation (initial: opacity 0 inside IIFE bundle)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const wrap = {
  minHeight: 400,
  background: '#111110',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export function AddTask() {
  return (
    <div style={wrap}>
      <div className="modal-box">
        <div className="modal-hdr">
          <span>Add daily task — Ray</span>
          <button className="modal-x">✕</button>
        </div>
        <label className="modal-lbl">Task</label>
        <input className="modal-input" placeholder="What needs doing?" defaultValue="" readOnly />
        <div className="modal-ftr">
          <button className="btn">Cancel</button>
          <button className="btn btn-primary">Add Task</button>
        </div>
      </div>
    </div>
  );
}

export function EditTask() {
  return (
    <div style={wrap}>
      <div className="modal-box">
        <div className="modal-hdr">
          <span>Edit weekly task — Jazelle</span>
          <button className="modal-x">✕</button>
        </div>
        <label className="modal-lbl">Task</label>
        <input className="modal-input" defaultValue="Clean bathroom" readOnly />
        <div style={{ marginTop: 14 }}>
          <label className="modal-lbl">Day of week</label>
          <div className="dow-grid" style={{ marginBottom: 12 }}>
            {DAYS.map((d, i) => (
              <button key={d} className={`dow-btn${i === 1 ? ' selected' : ''}`}>{d}</button>
            ))}
          </div>
        </div>
        <div className="modal-ftr">
          <button className="btn">Cancel</button>
          <button className="btn btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}
