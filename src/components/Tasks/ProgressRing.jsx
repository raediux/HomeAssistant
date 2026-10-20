import s from './Tasks.module.css';

const R = 22;
const CIRC = 2 * Math.PI * R;

// Avatar initial inside a ring that fills with today's progress.
export default function ProgressRing({ pct, label }) {
  return (
    <div className={s.ring}>
      <svg viewBox="0 0 52 52">
        <circle className={s.ringTrack} cx="26" cy="26" r={R} fill="none" strokeWidth="4" />
        <circle
          className={s.ringProg} cx="26" cy="26" r={R} fill="none" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={CIRC} style={{ strokeDashoffset: CIRC * (1 - pct) }}
        />
      </svg>
      <div className={s.ringAv}>{label}</div>
    </div>
  );
}
