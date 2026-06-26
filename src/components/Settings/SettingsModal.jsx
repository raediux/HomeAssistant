import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconX } from '@tabler/icons-react';
import { useHousehold } from '../../contexts/HouseholdContext.jsx';
import { dbSaveMemberColor } from '../../db.js';
import { useClickOutside } from '../../hooks/useClickOutside.js';
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
  const { members, setMemberColor } = useHousehold() ?? {};
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose);

  async function handleColorPick(memberId, color) {
    setMemberColor(memberId, color);
    await dbSaveMemberColor(memberId, color);
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
        {(members || []).map(member => (
          <div key={member.id} className={s.memberRow}>
            <div className={s.memberName} style={{ color: member.color }}>{member.name}</div>
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
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
