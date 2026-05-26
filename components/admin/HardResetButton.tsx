'use client';

import React, { useState } from 'react';
import { hardResetUserTeam } from '@/app/actions/adminActions';
import { useTelegramAuth } from '@/components/providers/TelegramAuthProvider';
import toast from 'react-hot-toast';

export function HardResetButton() {
  const [isResetting, setIsResetting] = useState(false);
  const { userId } = useTelegramAuth();

  const handleHardReset = async () => {
    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    if (!window.confirm("WARNING: This will permanently delete your entire franchise (Team, Players, Infrastructure, Standings). The app will reload and you will create a new team from scratch. Are you sure?")) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await hardResetUserTeam(userId);
      if (res.success) {
        toast.success(res.message || 'Hard reset successful');
        // Wait a moment then reload to trigger onboarding flow
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else {
        toast.error(res.error || 'Hard reset failed');
      }
    } catch (err: any) {
      toast.error('Network error during reset');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <button
      onClick={handleHardReset}
      disabled={isResetting}
      className={`mt-4 px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-all w-full flex items-center justify-center gap-2 ${
        isResetting
          ? 'bg-red-900/50 text-red-500 cursor-not-allowed'
          : 'bg-red-900/20 text-red-500 border border-red-500 hover:bg-red-500 hover:text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]'
      }`}
    >
      {isResetting ? 'RESETTING...' : '⚡ HARD RESET ROSTER'}
    </button>
  );
}
