import { useEffect } from 'react';
import { useIntro } from '@/contexts/IntroContext';
import { Step } from 'intro.js';

export function useIntroTour(tourId: string, steps: Step[], trigger: boolean = true) {
  const { startTour, isTourCompleted } = useIntro();

  useEffect(() => {
    if (trigger && !isTourCompleted(tourId)) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startTour(tourId, steps);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [trigger, tourId, steps, startTour, isTourCompleted]);

  return { startTour, isTourCompleted };
}
