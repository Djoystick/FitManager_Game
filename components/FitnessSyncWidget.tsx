'use client';

import { useState, useContext, useEffect } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { supabase } from '@/lib/supabase';
import { Activity, RefreshCw, Unlink, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function FitnessSyncWidget() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [dailySteps, setDailySteps] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  
  const MAX_STEPS = 20000;

  useEffect(() => {
    const fetchState = async () => {
      if (!userId) return;
      const { data } = await supabase.from('users').select('daily_steps, last_step_sync, google_refresh_token').eq('id', userId).single();
      if (data) {
        setIsConnected(!!data.google_refresh_token);
        const tzDate = new Date().toISOString().split('T')[0];
        if (data.last_step_sync === tzDate) {
           setDailySteps(data.daily_steps || 0);
           setLimitReached((data.daily_steps || 0) >= MAX_STEPS);
        } else {
           setDailySteps(0);
           setLimitReached(false);
        }
      }
    };
    if (isAuthenticated) fetchState();
  }, [userId, isAuthenticated]);

  const handleSync = async () => {
    if (!userId || limitReached) return;

    setIsSyncing(true);
    setSyncState('loading');

    const tzDate = new Date().toISOString().split('T')[0];
    const tzOffset = new Date().getTimezoneOffset();

    try {
      const res = await fetch('/api/fitness/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezoneDate: tzDate, timezoneOffsetMins: tzOffset })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setDailySteps(data.daily_steps_logged);
        setLimitReached(data.limit_reached);
        setSyncState('success');
        
        if (data.earned_sp > 0) {
          window.dispatchEvent(new Event('balanceUpdated'));
          toast.success(`+${data.earned_sp} SP earned from steps!`, { icon: '🏃' });
        } else {
          toast.success('Steps synchronized successfully!');
        }

        setTimeout(() => setSyncState('idle'), 2500);
      } else if (res.status === 403 && data.not_connected) {
        setIsConnected(false);
        setSyncState('idle');
        toast.error('Google Fit disconnected');
      } else {
        setSyncState('idle');
        toast.error(data.error || 'Failed to sync steps');
      }
    } catch (e) {
      console.error(e);
      setSyncState('idle');
      toast.error('Network error during sync');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to disconnect Google Fit? You will stop receiving steps.')) return;
    setIsUnlinking(true);
    try {
      const res = await fetch('/api/fitness/unlink', { method: 'POST' });
      if (res.ok) {
        setIsConnected(false);
        toast.success('Google Fit disconnected');
      } else {
        toast.error('Failed to unlink');
      }
    } catch (e) {
      toast.error('Error during unlink');
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/fitness/auth/google';
  };

  const progressPercent = Math.min(100, (dailySteps / MAX_STEPS) * 100);

  if (!isConnected) {
    return (
      <div className="w-full bg-gradient-to-r from-gray-900 to-black rounded-xl border border-gray-800 p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <Activity className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white uppercase tracking-wider">Google Fit</span>
            <span className="text-[10px] text-gray-400">Track real-world steps</span>
          </div>
        </div>
        <button 
          onClick={handleConnect}
          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 hover:text-blue-300 border border-blue-500/50 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-r from-gray-900 to-black rounded-xl border border-neon-cyan/20 p-4 flex flex-col gap-3 shadow-[0_4px_20px_rgba(0,240,255,0.05)]">
      <div className="flex items-center justify-between">
        {/* Left Side: Icon + Name */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/30">
            <Activity className="w-5 h-5 text-neon-cyan" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white uppercase tracking-wider">Google Fit</span>
              <CheckCircle2 className="w-3 h-3 text-neon-green" />
            </div>
            <span className="text-[10px] text-gray-400 font-mono">
              {dailySteps.toLocaleString()} / {MAX_STEPS.toLocaleString()} steps
            </span>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSync}
            disabled={isSyncing || limitReached || syncState === 'success'}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              syncState === 'success' 
                ? 'bg-neon-green/20 text-neon-green border border-neon-green'
                : limitReached
                  ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                  : 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/20 active:scale-95'
            }`}
          >
            {syncState === 'loading' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : syncState === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{syncState === 'success' ? 'Synced' : limitReached ? 'Max' : 'Sync'}</span>
          </button>
          
          <button 
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 transition-all group"
            title="Disconnect Google Fit"
          >
            <Unlink className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden mt-1">
        <div 
          className={`h-full transition-all duration-1000 ease-out ${
            progressPercent >= 100 ? 'bg-neon-green' : 'bg-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.5)]'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
