'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Tutorial Step Enum
// -1 = DONE (tutorial completed)
//  0 = WELCOME           → onboarding screen
//  1 = VIEW_SQUAD        → spotlight on "Состав" tab
//  2 = MOVE_PLAYER       → spotlight on player card (drag to starting XI)
//  3 = FIRST_MATCH       → spotlight on "Сыграть" button (practice match)
//  4 = CLAIM_REWARD      → spotlight on reward notification
// ─────────────────────────────────────────────────────────────────────────────
export const TUTORIAL_DONE = -1;
export type TutorialStep = -1 | 0 | 1 | 2 | 3 | 4;

const STORAGE_KEY = 'fm_tutorial_step';

interface TutorialContextValue {
  step: TutorialStep;
  isDone: boolean;
  nextStep: () => void;
  skipTutorial: () => void;
  setUserId: (id: string) => void;
}

const TutorialContext = createContext<TutorialContextValue>({
  step: 0,
  isDone: false,
  nextStep: () => {},
  skipTutorial: () => {},
  setUserId: () => {},
});

export function useTutorial() {
  return useContext(TutorialContext);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Persists tutorial step to DB asynchronously (fire-and-forget)
async function persistStep(userId: string | null, step: TutorialStep) {
  if (!userId) return;
  try {
    await supabase.rpc('save_tutorial_step', { p_user_id: userId, p_step: step });
  } catch (e) {
    console.warn('[TutorialContext] Failed to persist tutorial step:', e);
  }
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<TutorialStep>(0);
  const [userId, setUserIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // ── Hydrate from localStorage on mount (fast, avoids DB latency flash) ──
  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    setTimeout(() => {
      if (cached !== null) {
        const parsed = parseInt(cached, 10) as TutorialStep;
        setStep(isNaN(parsed) ? 0 : parsed);
      }
      setHydrated(true);
    }, 0);
  }, []);

  // ── When userId becomes available, sync from DB (source of truth) ────────
  const setUserId = useCallback(async (id: string) => {
    setUserIdState(id);
    try {
      const { data } = await supabase
        .from('users')
        .select('tutorial_step')
        .eq('id', id)
        .single();
      if (data?.tutorial_step !== undefined && data.tutorial_step !== null) {
        const dbStep = data.tutorial_step as TutorialStep;
        setStep(dbStep);
        localStorage.setItem(STORAGE_KEY, String(dbStep));
      }
    } catch (e) {
      console.warn('[TutorialContext] DB sync failed, using localStorage:', e);
    }
  }, []);

  const nextStep = useCallback(() => {
    setStep(prev => {
      const next = (prev === 4 ? TUTORIAL_DONE : (prev + 1)) as TutorialStep;
      localStorage.setItem(STORAGE_KEY, String(next));
      persistStep(userId, next);
      return next;
    });
  }, [userId]);

  const skipTutorial = useCallback(() => {
    setStep(TUTORIAL_DONE);
    localStorage.setItem(STORAGE_KEY, String(TUTORIAL_DONE));
    persistStep(userId, TUTORIAL_DONE);
  }, [userId]);

  if (!hydrated) return null; // Prevent flash of wrong tutorial state

  return (
    <TutorialContext.Provider
      value={{
        step,
        isDone: step === TUTORIAL_DONE,
        nextStep,
        skipTutorial,
        setUserId,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}
