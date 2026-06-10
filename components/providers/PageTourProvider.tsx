'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { SpotlightOverlay } from '@/components/onboarding/SpotlightOverlay';
import { createClient } from '@supabase/supabase-js';

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  buttonLabel?: string;
  onNext?: () => void;
}

interface PageTourContextValue {
  isActive: boolean;
  startTour: (tourId: string, steps: TourStep[]) => void;
  hasSeenTour: (tourId: string) => boolean;
  skipAllToursForever: () => void;
  areAllToursSkipped: () => boolean;
}

const PageTourContext = createContext<PageTourContextValue | null>(null);

export function usePageTour() {
  const ctx = useContext(PageTourContext);
  if (!ctx) throw new Error('usePageTour must be used within PageTourProvider');
  return ctx;
}

export function PageTourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const hasSeenTour = useCallback((tourId: string) => {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem('fm_skip_all_tours') === 'true') return true;
    return localStorage.getItem(`fm_tour_seen_${tourId}`) === 'true';
  }, []);

  const markTourSeen = useCallback((tourId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`fm_tour_seen_${tourId}`, 'true');
    }
  }, []);

  const areAllToursSkipped = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('fm_skip_all_tours') === 'true';
  }, []);

  const startTour = useCallback((tourId: string, newSteps: TourStep[]) => {
    if (newSteps.length === 0) return;
    setActiveTourId(tourId);
    setSteps(newSteps);
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsActive(false);
    if (activeTourId) {
      markTourSeen(activeTourId);
    }
    
    // Check if core modules are completed to give rewards
    checkCoreToursCompletion();
  }, [activeTourId, markTourSeen]);

  const handleNext = useCallback(() => {
    const current = steps[currentStepIndex];
    if (current.onNext) {
      current.onNext();
    }
    
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      closeTour();
    }
  }, [currentStepIndex, steps, closeTour]);

  const handleSkip = useCallback(() => {
    closeTour();
  }, [closeTour]);

  const skipAllToursForever = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fm_skip_all_tours', 'true');
      closeTour();
    }
  }, [closeTour]);

  // Logic to grant final reward
  async function checkCoreToursCompletion() {
    if (typeof window === 'undefined') return;
    
    // Core tours required for the reward:
    const coreTours = ['lineup', 'base', 'bank', 'market'];
    const allCompleted = coreTours.every(tour => localStorage.getItem(`fm_tour_seen_${tour}`) === 'true');
    
    if (allCompleted) {
      // Mark as -1 in DB to ensure backend knows the player finished onboarding
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        // Fire and forget
        window.dispatchEvent(new Event('onboardingCompleted'));
      } catch (e) {
        console.error('Failed to notify onboarding completion', e);
      }
    }
  };

  return (
    <PageTourContext.Provider
      value={{
        isActive,
        startTour,
        hasSeenTour,
        skipAllToursForever,
        areAllToursSkipped,
      }}
    >
      {children}
      {isActive && steps.length > 0 && (
        <SpotlightOverlay
          targetId={steps[currentStepIndex].targetId}
          title={steps[currentStepIndex].title}
          description={steps[currentStepIndex].description}
          buttonLabel={steps[currentStepIndex].buttonLabel || (currentStepIndex === steps.length - 1 ? 'Завершить' : 'Далее →')}
          onNext={handleNext}
          onSkip={handleSkip}
        />
      )}
    </PageTourContext.Provider>
  );
}
