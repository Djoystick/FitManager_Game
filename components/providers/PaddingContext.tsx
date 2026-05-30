'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// PaddingContext — controls 60px top padding for TMA fullscreen mode.
// Telegram's system UI (close button, ⋮ menu) overlaps our content in
// fullscreen mode. This context lets the user toggle a safe-area padding.
//
// Storage strategy:
//   1. localStorage — instant, no flash on mount
//   2. DB (users.tma_padding_enabled) — persists across devices/reinstalls
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'fm_tma_padding';
const PADDING_PX = 60;

interface PaddingContextValue {
  paddingEnabled: boolean;
  paddingStyle: { paddingTop: string };
  togglePadding: () => void;
  setUserId: (id: string) => void;
}

const PaddingContext = createContext<PaddingContextValue>({
  paddingEnabled: true,
  paddingStyle: { paddingTop: `${PADDING_PX}px` },
  togglePadding: () => {},
  setUserId: () => {},
});

export function usePadding() {
  return useContext(PaddingContext);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function persistPadding(userId: string | null, enabled: boolean) {
  if (!userId) return;
  try {
    await supabase.rpc('save_padding_preference', { p_user_id: userId, p_enabled: enabled });
  } catch (e) {
    console.warn('[PaddingContext] Failed to persist preference:', e);
  }
}

export function PaddingProvider({ children }: { children: ReactNode }) {
  // Default TRUE — safer on first launch inside Telegram
  const [paddingEnabled, setPaddingEnabled] = useState(true);
  const [userId, setUserIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // ── Fast hydration from localStorage ─────────────────────────────────────
  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached !== null) {
      setPaddingEnabled(cached === 'true');
    }
    setHydrated(true);
  }, []);

  // ── DB sync when userId becomes available ─────────────────────────────────
  const setUserId = useCallback(async (id: string) => {
    setUserIdState(id);
    try {
      const { data } = await supabase
        .from('users')
        .select('tma_padding_enabled')
        .eq('id', id)
        .single();
      if (data?.tma_padding_enabled !== undefined && data.tma_padding_enabled !== null) {
        setPaddingEnabled(data.tma_padding_enabled);
        localStorage.setItem(STORAGE_KEY, String(data.tma_padding_enabled));
      }
    } catch (e) {
      console.warn('[PaddingContext] DB sync failed, using localStorage.');
    }
  }, []);

  const togglePadding = useCallback(() => {
    setPaddingEnabled(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      persistPadding(userId, next);
      return next;
    });
  }, [userId]);

  if (!hydrated) return null;

  return (
    <PaddingContext.Provider
      value={{
        paddingEnabled,
        paddingStyle: { paddingTop: paddingEnabled ? `${PADDING_PX}px` : '0px' },
        togglePadding,
        setUserId,
      }}
    >
      {children}
    </PaddingContext.Provider>
  );
}
