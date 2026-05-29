import React from 'react';
import { supabase } from '@/lib/supabase';
import { LogSessionButton } from '@/components/training/LogSessionButton';
import { Activity, AlertTriangle, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { ScreenGuide } from '@/components/ui/ScreenGuide';

export default async function TrainingDashboard({ searchParams }: { searchParams: Promise<{ userId?: string }> | { userId?: string } }) {
  const resolvedParams = await searchParams;
  const userId = resolvedParams.userId;

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4 text-center">
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.3)]">
          <h2 className="font-bold text-lg mb-1">Unauthorized</h2>
          <p className="text-sm">Cannot view training dashboard without a valid userId in query parameters.</p>
        </div>
      </div>
    );
  }

  // Fetch recent training sessions
  const { data: sessions } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Calculate current penalty factor for TODAY
  const todayStr = new Date().toISOString().split('T')[0];
  const todaysSessions = sessions?.filter(s => s.session_date === todayStr && (s.status === 'approved' || s.status === 'penalized')) || [];
  
  // Rule from SQL: GREATEST(0.00, 1.00 - (prior_sessions * 0.10))
  const priorCount = todaysSessions.length;
  const currentPenaltyFactor = Math.max(0, 1.0 - (priorCount * 0.10));
  
  const isPenalized = currentPenaltyFactor < 1.0;
  const isExhausted = currentPenaltyFactor === 0;

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar">
      <ScreenGuide 
        key="training"
        screenName="training"
        title="Тренировочная база"
        content="Ваша реальная физическая активность (шаги) конвертируется в Sweat Points (SP). Используйте SP для тренировки кибер-атлетов и буста их характеристик!"
      />
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-gray-800 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider">
            Training Hub
          </h1>
          <p className="text-sm text-gray-400">Proof-of-Effort Validation Dashboard</p>
        </div>
        
        <LogSessionButton userId={userId} />
      </header>

      {/* Anti-Cheat / Overtraining Status Indicator */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Current Multiplier Status</h2>
        
        <div className={`
          relative overflow-hidden rounded-lg p-4 border flex items-center gap-4 shadow-lg transition-all
          ${isExhausted 
            ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
            : isPenalized 
              ? 'bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
              : 'bg-neon-green/10 border-neon-green/30 shadow-[0_0_15px_rgba(57,255,20,0.1)]'
          }
        `}>
          <div className="flex-shrink-0">
            {isExhausted ? (
              <XCircle className="text-red-500" size={32} />
            ) : isPenalized ? (
              <AlertTriangle className="text-yellow-500" size={32} />
            ) : (
              <Zap className="text-neon-green" size={32} />
            )}
          </div>
          
          <div className="flex flex-col flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">XP Multiplier</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black font-orbitron ${
                isExhausted ? 'text-red-500' : isPenalized ? 'text-yellow-500' : 'text-neon-green'
              }`}>
                {(currentPenaltyFactor * 100).toFixed(0)}%
              </span>
              <span className="text-sm text-gray-400 font-medium">Yield</span>
            </div>
          </div>

          <div className="hidden sm:block text-xs text-gray-400 max-w-xs leading-relaxed">
            {isExhausted 
              ? "You are completely exhausted. Further training today will yield 0 TP." 
              : isPenalized 
                ? "Overtraining detected. Your TP yield is reduced to prevent fatigue and injury."
                : "You are fresh. Next session yields 100% of standard Training Points."}
          </div>
        </div>
      </section>

      {/* Recent Sessions List */}
      <section className="flex flex-col gap-4 mt-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-neon-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
          Recent Activity
        </h2>
        
        {sessions && sessions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_5px_15px_rgba(0,0,0,0.5)]"
              >
                {/* Left: Date & Type */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-mono">
                    {new Date(session.created_at).toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-white uppercase tracking-wider">
                    {session.duration_minutes} MIN RUN/WALK
                  </span>
                </div>

                {/* Center: Details */}
                <div className="flex gap-4 text-xs font-mono">
                  <div className="flex flex-col items-center">
                    <span className="text-gray-500">STEPS</span>
                    <span className="text-gray-300">{session.steps_logged}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-gray-500">MET</span>
                    <span className="text-gray-300">{session.met_value}</span>
                  </div>
                </div>

                {/* Right: TP & Status */}
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase text-gray-500 tracking-wider">Yield</span>
                    <span className={`text-sm font-bold font-orbitron ${
                      session.status === 'rejected' ? 'text-gray-500' : 'text-neon-cyan'
                    }`}>
                      +{session.tp_earned} TP
                    </span>
                  </div>
                  
                  {/* Status Badge */}
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1
                    ${session.status === 'approved' ? 'bg-neon-green/10 text-neon-green border-neon-green/50' : ''}
                    ${session.status === 'penalized' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50' : ''}
                    ${session.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/50' : ''}
                    ${session.status === 'pending' ? 'bg-gray-500/10 text-gray-400 border-gray-500/50' : ''}
                  `}>
                    {session.status === 'approved' && <CheckCircle2 size={12} />}
                    {session.status === 'penalized' && <AlertTriangle size={12} />}
                    {session.status === 'rejected' && <XCircle size={12} />}
                    {session.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border border-dashed border-gray-800 rounded-lg bg-black/40">
            <Activity className="mx-auto text-gray-700 mb-2" size={32} />
            <h3 className="text-gray-400 font-bold mb-1">No Activity Found</h3>
            <p className="text-xs text-gray-600 max-w-xs mx-auto">
              You haven't logged any training sessions yet. Connect your step tracker to start earning TP.
            </p>
          </div>
        )}
      </section>

    </div>
  );
}
