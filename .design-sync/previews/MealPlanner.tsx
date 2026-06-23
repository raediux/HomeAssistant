import { MealPlanner, MockProviders } from 'home-assistant-react';
import { MotionConfig } from 'framer-motion';

export function Default() {
  return (
    <MotionConfig reducedMotion="always">
      <MockProviders>
        <div style={{ background: '#111110', minHeight: 600 }}>
          <MealPlanner />
        </div>
      </MockProviders>
    </MotionConfig>
  );
}
