'use client';

import React, { useState, useTransition } from 'react';
import { Activity } from 'lucide-react';
import { logTrainingSession } from '@/app/actions/trainingActions';

export function LogSessionButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const handleLogSession = () => {
    startTransition(async () => {
      try {
        // Generate a random duration (30-60 mins) and steps (3000-6000) for testing/simulation
        const duration = Math.floor(Math.random() * 30) + 30;
        const steps = duration * 100 + Math.floor(Math.random() * 500);
        
        const result = await logTrainingSession(userId, duration, steps);
        
        if (result.success) {
          if (result.status === 'rejected') {
            setToastMessage({ text: 'Session rejected. Fully exhausted (0% Yield).', type: 'error' });
          } else if (result.status === 'penalized') {
            setToastMessage({ text: `Session penalized. Yield: ${(result.factor * 100).toFixed(0)}% (+${result.earnedTp} TP)`, type: 'warning' });
          } else {
            setToastMessage({ text: `Session approved! Earned: +${result.earnedTp} TP`, type: 'success' });
          }
        } else {
          setToastMessage({ text: result.error || 'Failed to log session.', type: 'error' });
        }
      } catch (error: any) {
        setToastMessage({ text: 'Unexpected error occurred.', type: 'error' });
      } finally {
        // Auto-dismiss toast after 4 seconds
        setTimeout(() => setToastMessage(null), 4000);
      }
    });
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg font-bold text-sm backdrop-blur-sm animate-in slide-in-from-top-2 border
          ${toastMessage.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : ''}
          ${toastMessage.type === 'warning' ? 'bg-yellow-500/90 border-yellow-400 text-black' : ''}
          ${toastMessage.type === 'success' ? 'bg-neon-green/90 border-green-400 text-black' : ''}
        `}>
          {toastMessage.text}
        </div>
      )}

      <button 
        onClick={handleLogSession}
        disabled={isPending}
        className={`
          flex items-center justify-center gap-2 w-full sm:w-auto 
          px-6 py-3 rounded-lg font-bold uppercase tracking-widest text-sm
          transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]
          ${isPending 
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' 
            : 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_20px_rgba(0,240,255,0.6)]'
          }
        `}
      >
        <Activity size={18} className={isPending ? 'animate-pulse' : ''} />
        {isPending ? 'Syncing...' : 'Log Training Session'}
      </button>
    </>
  );
}
