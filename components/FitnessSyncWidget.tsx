'use client';

import { useState, useContext, useEffect } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { supabase } from '@/lib/supabase';

export function FitnessSyncWidget() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  
  const [stepsInput, setStepsInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [dailySteps, setDailySteps] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  
  const MAX_STEPS = 20000;

  useEffect(() => {
    const fetchState = async () => {
      if (!userId) return;
      const { data } = await supabase.from('users').select('daily_steps_logged, last_sync_date').eq('id', userId).single();
      if (data) {
        const tzDate = new Date().toISOString().split('T')[0];
        if (data.last_sync_date === tzDate) {
           setDailySteps(data.daily_steps_logged || 0);
           setLimitReached((data.daily_steps_logged || 0) >= MAX_STEPS);
        } else {
           setDailySteps(0);
           setLimitReached(false);
        }
      }
    };
    if (isAuthenticated) fetchState();
  }, [userId, isAuthenticated]);

  const handleSync = async () => {
    const steps = parseInt(stepsInput, 10);
    if (!userId || isNaN(steps) || steps <= 0 || limitReached) return;

    setIsSyncing(true);
    setSyncState('loading');

    const tzDate = new Date().toISOString().split('T')[0];

    try {
      const res = await fetch('/api/fitness/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, steps, timezoneDate: tzDate })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setDailySteps(data.daily_steps_logged);
        setLimitReached(data.limit_reached);
        setSyncState('success');
        setStepsInput('');
        
        if (data.earned_tp > 0) {
          window.dispatchEvent(new Event('balanceUpdated'));
        }

        setTimeout(() => setSyncState('idle'), 2000);
      } else {
        setSyncState('idle');
      }
    } catch (e) {
      console.error(e);
      setSyncState('idle');
    } finally {
      setIsSyncing(false);
    }
  };

  const progressPercent = Math.min(100, (dailySteps / MAX_STEPS) * 100);
  const isWarning = progressPercent >= 80;
  const isDanger = progressPercent >= 100;
  
  const barColor = isDanger 
    ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' 
    : isWarning 
      ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]' 
      : 'bg-neon-cyan shadow-[0_0_15px_rgba(0,240,255,0.8)]';

  const buttonClass = syncState === 'success' 
    ? 'bg-neon-green text-black shadow-[0_0_20px_rgba(57,255,20,0.8)] border-transparent'
    : syncState === 'loading'
      ? 'bg-transparent border border-neon-cyan text-neon-cyan'
      : limitReached
        ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
        : 'bg-neon-pink/10 border border-neon-pink text-neon-pink hover:bg-neon-pink hover:text-white shadow-[0_0_15px_rgba(255,0,60,0.4)] hover:shadow-[0_0_25px_rgba(255,0,60,0.8)]';

  return (
    <div className="w-full bg-black/60 backdrop-blur-md rounded-2xl border border-neon-cyan/30 p-6 flex flex-col gap-6 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
      {/* Background glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-bold font-orbitron tracking-widest uppercase text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Step Sync</h2>
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Daily Limit: 20k</span>
        </div>
        
        {/* Progress Bar Container */}
        <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-800 relative shadow-inner">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${barColor}`} 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono">
          <span className={`${isDanger ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-neon-cyan'}`}>
            {dailySteps.toLocaleString()} logged
          </span>
          <span className="text-gray-500">{(MAX_STEPS - dailySteps).toLocaleString()} remaining</span>
        </div>
      </div>

      {/* Terminal Input */}
      <div className="relative z-10 bg-black/80 border border-gray-700 rounded-lg p-1 flex items-center shadow-inner group focus-within:border-neon-cyan transition-colors">
        <div className="px-3 text-neon-cyan font-mono text-sm opacity-50 select-none">{'>'}</div>
        <input 
          type="number" 
          value={stepsInput}
          onChange={(e) => setStepsInput(e.target.value)}
          placeholder="ENTER_STEPS..."
          disabled={limitReached || isSyncing}
          className="bg-transparent text-white font-mono placeholder-gray-600 focus:outline-none w-full py-3"
        />
        {stepsInput && !isSyncing && !limitReached && (
           <div className="pr-4 text-[10px] text-gray-500 font-bold tracking-widest whitespace-nowrap">
             ≈ {Math.floor(parseInt(stepsInput, 10) / 100) || 0} TP
           </div>
        )}
      </div>

      {/* Action Button */}
      <button 
        onClick={handleSync}
        disabled={isSyncing || limitReached || !stepsInput}
        className={`relative z-10 w-full py-4 rounded-lg font-bold uppercase tracking-widest transition-all duration-300 overflow-hidden ${buttonClass}`}
      >
        {syncState === 'loading' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin"></span>
            SYNCING_DATA...
          </span>
        ) : syncState === 'success' ? (
          <span className="tracking-widest">DATA_UPLOADED</span>
        ) : limitReached ? (
          <span>LIMIT_REACHED</span>
        ) : (
          <span>INITIATE_SYNC</span>
        )}
      </button>
    </div>
  );
}
