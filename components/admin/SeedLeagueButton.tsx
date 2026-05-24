'use client';

import React, { useState, useTransition } from 'react';
import { seedBotLeague } from '@/app/actions/adminActions';
import { Loader2, Database, CheckCircle, AlertTriangle } from 'lucide-react';

export function SeedLeagueButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleSeed = () => {
    setStatus(null);
    startTransition(async () => {
      const res = await seedBotLeague();
      setStatus({ 
        success: res.success, 
        message: res.success && res.message ? res.message : (res.error || 'Unknown error occurred.') 
      });
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <button
        onClick={handleSeed}
        disabled={isPending}
        className="relative group w-full px-6 py-4 bg-gray-900 border border-gray-700 hover:border-neon-cyan text-white font-orbitron font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
            <span>Seeding Database...</span>
          </>
        ) : (
          <>
            <Database className="w-5 h-5 text-gray-400 group-hover:text-neon-cyan transition-colors" />
            <span>Seed Bot League (13 Teams)</span>
          </>
        )}
      </button>

      {status && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${status.success ? 'bg-neon-green/10 border-neon-green/50 text-neon-green' : 'bg-red-500/10 border-red-500/50 text-red-500'}`}>
          {status.success ? <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}
    </div>
  );
}
