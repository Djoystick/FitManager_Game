'use client';

import { useState } from 'react';
import { generateLeagueSchedule, simulateNextRound } from '@/app/actions/calendarActions';
import { CalendarDays, FastForward } from 'lucide-react';

export function ScheduleButtons() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await generateLeagueSchedule();
      if (res.success) {
        alert("Success: " + res.message);
      } else {
        alert("Error: " + res.error);
      }
    } catch (err: any) {
      alert("System error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const res = await simulateNextRound();
      if (res.success) {
        alert("Success: " + res.message);
      } else {
        alert("Error: " + res.error);
      }
    } catch (err: any) {
      alert("System error: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button 
        onClick={handleGenerate}
        disabled={isGenerating || isSimulating}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold uppercase tracking-widest text-xs transition-all border shadow-lg
          ${isGenerating || isSimulating
            ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
            : 'bg-purple-900/30 text-neon-purple border-neon-purple hover:bg-neon-purple hover:text-white shadow-[0_0_15px_rgba(188,19,254,0.3)]'
          }`}
      >
        <CalendarDays size={16} />
        {isGenerating ? 'Generating...' : 'Generate Schedule (13 Rounds)'}
      </button>

      <button 
        onClick={handleSimulate}
        disabled={isGenerating || isSimulating}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold uppercase tracking-widest text-xs transition-all border shadow-lg
          ${isGenerating || isSimulating
            ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
            : 'bg-green-900/30 text-neon-green border-neon-green hover:bg-neon-green hover:text-black shadow-[0_0_15px_rgba(57,255,20,0.3)]'
          }`}
      >
        <FastForward size={16} />
        {isSimulating ? 'Simulating...' : '⏩ Fast-Forward Next Round'}
      </button>
    </div>
  );
}
