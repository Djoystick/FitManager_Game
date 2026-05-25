'use client';

import { useState, useContext } from 'react';
import { generateLeagueSchedule, simulateNextRound } from '@/app/actions/calendarActions';
import { CalendarDays, FastForward } from 'lucide-react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { MatchReportModal, MatchReport } from '@/components/MatchReportModal';
import { useRouter } from 'next/navigation';

export function ScheduleButtons() {
  const { userId } = useContext(TelegramAuthContext);
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [reportData, setReportData] = useState<{ report: MatchReport, teamId: string } | null>(null);

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
      const res = await simulateNextRound(userId || undefined);
      if (res.success) {
        if (res.userMatchReport && res.userTeamId) {
          setReportData({ report: res.userMatchReport, teamId: res.userTeamId });
        } else {
          alert("Success: " + res.message);
          window.dispatchEvent(new Event('matchSimulated'));
          router.refresh();
        }
      } else {
        alert("Error: " + res.error);
      }
    } catch (err: any) {
      alert("System error: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCloseReport = () => {
    setReportData(null);
    window.dispatchEvent(new Event('matchSimulated'));
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
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

      {reportData && (
        <MatchReportModal 
          report={reportData.report} 
          userTeamId={reportData.teamId} 
          onClose={handleCloseReport} 
        />
      )}
    </div>
  );
}
