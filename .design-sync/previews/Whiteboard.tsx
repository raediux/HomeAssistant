import { Whiteboard, MockProviders } from 'home-assistant-react';
import { MotionConfig } from 'framer-motion';

export function Default() {
  return (
    <MotionConfig reducedMotion="always">
      <MockProviders>
        <div style={{ background: '#111110', minHeight: 400 }}>
          <Whiteboard />
        </div>
      </MockProviders>
    </MotionConfig>
  );
}
