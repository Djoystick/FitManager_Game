'use client';

import React, { useState } from 'react';
import { CalendarSync, DatabaseBackup, Coins } from 'lucide-react';
import { HardResetButton } from '@/components/admin/HardResetButton';
import { simulateNextPendingMatch } from '@/app/actions/matchActions';
import { addSweatPoints } from '@/app/actions/adminActions';

interface Props {
  userId: string;
}

export function AdminConsoleClient({ userId }: Props) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [isAddingSP, setIsAddingSP] = useState(false);
  const [spAmount, setSpAmount] = useState(100);

  const handleSimulate = async () => {
    setIsSimulating(true);
    const result = await simulateNextPendingMatch(userId);
    setIsSimulating(false);
    
    if (result && !result.success) {
      alert(`Simulation failed: ${result.error}`);
    } else if (result && result.success) {
      window.location.href = '/';
    }
  };

  const handleAddSP = async () => {
    setIsAddingSP(true);
    await addSweatPoints(spAmount);
    setIsAddingSP(false);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* 1. MATCHES */}
      <section className="bg-black/40 border border-gray-800 rounded-xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-start gap-4">
        <div className="w-12 h-12 bg-neon-purple/10 rounded-full flex items-center justify-center border border-neon-purple/30 flex-shrink-0">
          <CalendarSync className="text-neon-purple" size={24} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-white mb-2 text-lg">Live Match Engine</h2>
          <p className="text-sm text-gray-400 mb-4">
            Find the nearest pending match for your team and resolve it instantly using the new Core Engine.
          </p>
          <button 
            onClick={handleSimulate}
            disabled={isSimulating}
            className="w-full py-3 rounded bg-neon-purple/20 text-neon-purple border border-neon-purple/50 hover:bg-neon-purple hover:text-white transition-colors disabled:opacity-50 uppercase tracking-widest font-bold text-sm"
          >
            {isSimulating ? 'Simulating...' : 'Simulate Upcoming Match'}
          </button>
        </div>
      </section>

      {/* 2. BANK (W2E) */}
      <section className="bg-black/40 border border-gray-800 rounded-xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-start gap-4">
        <div className="w-12 h-12 bg-neon-green/10 rounded-full flex items-center justify-center border border-neon-green/30 flex-shrink-0">
          <Coins className="text-neon-green" size={24} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-white mb-2 text-lg">Bank (W2E SP Injection)</h2>
          <p className="text-sm text-gray-400 mb-4">
            Directly inject Sweat Points (SP) into your team's balance for testing Chemistry limits and purchases.
          </p>
          <div className="flex gap-2">
            <input 
              type="number" 
              value={spAmount}
              onChange={(e) => setSpAmount(Number(e.target.value))}
              className="w-24 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono focus:border-neon-green outline-none"
            />
            <button 
              onClick={handleAddSP}
              disabled={isAddingSP}
              className="flex-1 py-3 rounded bg-neon-green/20 text-neon-green border border-neon-green/50 hover:bg-neon-green hover:text-black transition-colors disabled:opacity-50 uppercase tracking-widest font-bold text-sm"
            >
              {isAddingSP ? 'Injecting...' : 'Inject SP'}
            </button>
          </div>
        </div>
      </section>

      {/* 3. RESET */}
      <section className="bg-black/40 border border-gray-800 rounded-xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-start gap-4">
        <div className="w-12 h-12 bg-neon-cyan/10 rounded-full flex items-center justify-center border border-neon-cyan/30 flex-shrink-0">
          <DatabaseBackup className="text-neon-cyan" size={24} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-white mb-2 text-lg">World Reset (Big Bang)</h2>
          <p className="text-sm text-gray-400 mb-4">
            Total wipe of your team, all bots, and the league schedule. Redirects to a clean Onboarding to generate a new world.
          </p>
          <HardResetButton />
        </div>
      </section>

    </div>
  );
}
