import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import introJs, { IntroJs, Step } from 'intro.js';
import 'intro.js/introjs.css';

interface TourState {
  completedTours: string[];
  currentTour: string | null;
  skipAllTours: boolean;
}

interface IntroContextType {
  startTour: (tourId: string, steps: Step[]) => void;
  completeTour: (tourId: string) => void;
  resetTours: () => void;
  isTourCompleted: (tourId: string) => boolean;
  skipAllTours: boolean;
  setSkipAllTours: (skip: boolean) => void;
}

const IntroContext = createContext<IntroContextType | undefined>(undefined);

const STORAGE_KEY = 'orchestra_intro_state';

export function IntroProvider({ children }: { children: ReactNode }) {
  const [tourState, setTourState] = useState<TourState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved
      ? JSON.parse(saved)
      : { completedTours: [], currentTour: null, skipAllTours: false };
  });

  const [introInstance, setIntroInstance] = useState<IntroJs | null>(null);

  // Persist state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tourState));
  }, [tourState]);

  const startTour = (tourId: string, steps: Step[]) => {
    if (tourState.skipAllTours || tourState.completedTours.includes(tourId)) {
      return;
    }

    const intro = introJs();

    // Custom theme configuration
    intro.setOptions({
      steps,
      showProgress: true,
      showBullets: true,
      exitOnOverlayClick: false,
      exitOnEsc: true,
      nextLabel: 'Next →',
      prevLabel: '← Back',
      doneLabel: 'Done',
      skipLabel: 'Skip Tour',
      tooltipClass: 'orchestra-intro-tooltip',
      highlightClass: 'orchestra-intro-highlight',
      scrollToElement: true,
      scrollPadding: 30,
    });

    intro.onbeforeexit(() => {
      const confirmed = confirm(
        'Are you sure you want to exit the tour? You can restart it anytime from the help menu.'
      );
      return confirmed;
    });

    intro.oncomplete(() => {
      completeTour(tourId);
    });

    intro.onexit(() => {
      setTourState((prev) => ({ ...prev, currentTour: null }));
    });

    setTourState((prev) => ({ ...prev, currentTour: tourId }));
    setIntroInstance(intro);
    intro.start();
  };

  const completeTour = (tourId: string) => {
    setTourState((prev) => ({
      ...prev,
      completedTours: [...prev.completedTours, tourId],
      currentTour: null,
    }));
  };

  const resetTours = () => {
    setTourState({ completedTours: [], currentTour: null, skipAllTours: false });
  };

  const isTourCompleted = (tourId: string) => {
    return tourState.completedTours.includes(tourId);
  };

  const setSkipAllTours = (skip: boolean) => {
    setTourState((prev) => ({ ...prev, skipAllTours: skip }));
  };

  return (
    <IntroContext.Provider
      value={{
        startTour,
        completeTour,
        resetTours,
        isTourCompleted,
        skipAllTours: tourState.skipAllTours,
        setSkipAllTours,
      }}
    >
      {children}
    </IntroContext.Provider>
  );
}

export function useIntro() {
  const context = useContext(IntroContext);
  if (!context) {
    throw new Error('useIntro must be used within IntroProvider');
  }
  return context;
}
