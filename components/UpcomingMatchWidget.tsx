'use client';

import { useEffect, useState } from 'react';
import { getUpcomingOpponentScoutReport, ScoutReport } from '@/app/actions/scoutActions';
import { ScoutReportModal } from '@/components/ScoutReportModal';
import { Shield, Radar, ChevronRight } from 'lucide-react';

export function UpcomingMatchWidget({ userId }: { userId: string }) {
  const [report, setReport] = useState<ScoutReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchScoutData = async () => {
      setIsLoading(true);
      try {
        const res = await getUpcomingOpponentScoutReport(userId);
        if (mounted && res.success && res.data) {
          setReport(res.data);
        }
      } catch (err) {
        console.error('Failed to load scout report', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    if (userId) {
      fetchScoutData();
    }
  }, [userId]);

  if (isLoading) {
    return (
      <div className="bg-black/40 border border-gray-800 rounded-xl p-4 flex justify-center items-center h-24">
        <div className="w-5 h-5 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!report) {
    return null; // Don't show widget if no upcoming matches
  }

  return (
    <>
      <div className="bg-black/60 border border-neon-cyan/30 rounded-xl overflow-hidden shadow-[0_5px_20px_rgba(0,240,255,0.1)]">
        <div className="bg-gradient-to-r from-neon-cyan/20 to-transparent p-3 border-b border-neon-cyan/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radar className="w-4 h-4 text-neon-cyan animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-neon-cyan font-orbitron">
              Next Match Intel
            </h3>
          </div>
          <span className="text-[10px] bg-black px-2 py-1 rounded border border-neon-cyan/50 text-neon-cyan font-mono">
            ROUND {report.round_number}
          </span>
        </div>
        
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-900 border-2 border-red-500 flex items-center justify-center shadow-[0_0_10px_rgba(255,0,0,0.3)] shrink-0">
              <Shield className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Opponent Target</p>
              <h4 className="text-lg font-black text-white uppercase truncate font-orbitron">
                {report.opponent_team_name}
              </h4>
            </div>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full py-2.5 rounded bg-black border border-neon-cyan text-neon-cyan text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all group"
          >
            <span>View Scout Report</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {isModalOpen && (
        <ScoutReportModal report={report} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
