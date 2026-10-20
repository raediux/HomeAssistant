import { forwardRef, useState } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { FREQUENCIES, FREQ_LABEL } from '../../config/tasks.js';
import { memberSlug, cn } from '../../utils.js';
import s from './Tasks.module.css';

// One-line add bar. Enter adds with no day/date; "More…" opens the full modal
// (pre-filled with whatever was typed) for weekday, due date or repeat.
const QuickAdd = forwardRef(function QuickAdd({ members, person, frequency, onPerson, onFrequency, onAdd, onMore }, ref) {
  const [title, setTitle] = useState('');
  const member = members.find(m => (m.slug ?? memberSlug(m.name)) === person) ?? members[0];

  function add() {
    const t = title.trim();
    if (!t) { ref.current?.focus(); return; }
    onAdd(t);
    setTitle('');
  }

  function more() {
    onMore(title.trim());
    setTitle('');
  }

  return (
    <div className={s.quick} style={{ '--col': member.color }}>
      <input
        ref={ref}
        className={s.quickInput}
        maxLength={200}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') add(); }}
        placeholder={`Add a task for ${member.name}…`}
      />
      <div className={s.seg}>
        {members.map(m => {
          const slug = m.slug ?? memberSlug(m.name);
          return (
            <button key={slug} className={cn(slug === person && s.segOn)} style={{ '--col': m.color }} onClick={() => { onPerson(slug); ref.current?.focus(); }}>
              <span className={s.segDot} />{m.name}
            </button>
          );
        })}
      </div>
      <div className={s.seg}>
        {FREQUENCIES.map(f => (
          <button key={f} className={cn(f === frequency && s.segOn)} onClick={() => onFrequency(f)}>{FREQ_LABEL[f]}</button>
        ))}
      </div>
      <button className={s.quickMore} onClick={more}>More…</button>
      <button className={s.quickAdd} onClick={add}><IconPlus size={15} />Add</button>
    </div>
  );
});

export default QuickAdd;
