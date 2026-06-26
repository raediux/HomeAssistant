import { useRef } from 'react';
import { motion } from 'framer-motion';
import { IconX } from '@tabler/icons-react';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { useSession } from '../../contexts/AuthContext.jsx';
import { dbSaveMemberColor, dbSetMemberSharesMeals } from '../../db.js';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import ColorPicker from '../Tasks/ColorPicker.jsx';
import s from './SettingsModal.module.css';

const MODAL_SPRING = { type: 'spring', stiffness: 380, damping: 28, mass: 0.9 };

const SWATCHES = [
  '#4a8fd4', // blue
  '#c46090', // pink
  '#c9a838', // yellow
  '#64c882', // green
  '#3db5a0', // teal
  '#9b6dd4', // purple
  '#d4874a', // orange
  '#d45a5a', // red
  '#4ab5d4', // cyan
  '#8dc44a', // lime
  '#d44a8f', // rose
  '#b0a898', // warm grey
];

export default function SettingsModal({ onClose }) {
  const { members, setMemberColor, setMemberSharesMeals } = useHousehold() ?? {};
  const session = useSession();
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose);

  const myMember = (members || []).find(m => m.user_id === session?.user?.id);
  const isOwner  = myMember?.role === 'owner';

  function canEdit(member) {
    return isOwner || member.user_id === session?.user?.id;
  }

  async function handleColorPick(memberId, color) {
    setMemberColor(memberId, color);
    await dbSaveMemberColor(memberId, color);
  }

  async function handleSharesMeals(memberId, value) {
    setMemberSharesMeals(memberId, value);
    await dbSetMemberSharesMeals(memberId, value);
  }

  return (
    <div className={s.overlay}>
      <motion.div
        ref={panelRef}
        className={s.panel}
        initial={{ opacity: 0, scale: 0.94, y: -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: -12 }}
        transition={MODAL_SPRING}
      >
        <div className={s.header}>
          <span className={s.title}>Settings</span>
          <button className={s.closeBtn} onClick={onClose}><IconX size={16} /></button>
        </div>

        <div className={s.section}>Member colours</div>
        {(members || []).map(member => {
          const editable = canEdit(member);
          return (
            <div key={member.id} className={`${s.memberRow} ${!editable ? s.memberRowLocked : ''}`}>
              <div className={s.memberName} style={{ color: member.color }}>{member.name}</div>
              {editable ? (
                <div className={s.swatches}>
                  {SWATCHES.map(color => (
                    <button
                      key={color}
                      className={`${s.swatch} ${member.color === color ? s.swatchActive : ''}`}
                      style={{ background: color }}
                      title={color}
                      onClick={() => handleColorPick(member.id, color)}
                    />
                  ))}
                  <ColorPicker color={member.color} onChange={c => handleColorPick(member.id, c)} />
                </div>
              ) : (
                <div className={s.locked}>Only {member.name} can change this</div>
              )}
            </div>
          );
        })}

        {isOwner && (
          <>
            <div className={s.section}>Default meal sharing</div>
            {(members || []).map(member => (
              <div key={member.id} className={s.toggleRow}>
                <span className={s.toggleName} style={{ color: member.color }}>{member.name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={member.sharesMeals}
                  className={`${s.toggle} ${member.sharesMeals ? s.toggleOn : ''}`}
                  onClick={() => handleSharesMeals(member.id, !member.sharesMeals)}
                >
                  <span className={s.toggleKnob} />
                </button>
              </div>
            ))}
            <div className={s.hint}>The default sharing group for new weeks. Any week can override this from the planner’s “Sharing” button. Needs 2 or more to link a meal.</div>
          </>
        )}
      </motion.div>
    </div>
  );
}
