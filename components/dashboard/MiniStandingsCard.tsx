'use client';

import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { Trophy, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface StandingEntry {
  team_id: string;
  team_name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
}

interface Props {
  standings: StandingEntry[];
  userTeamId: string | null;
  language?: string;
}

export function MiniStandingsCard({ standings, userTeamId, language = 'en' }: Props) {
  const t = dict[language as keyof typeof dict] || dict['en'];

  const userEntry = standings.find(s => s.team_id === userTeamId);
  const userRank = userEntry ? standings.indexOf(userEntry) + 1 : null;

  const entries: { rank: number; name: string; pts: number; isUser: boolean }[] = [];

  if (userRank && userRank > 1) {
    const above = standings[userRank - 2];
    if (above) entries.push({ rank: userRank - 1, name: above.team_name, pts: above.points, isUser: false });
  }
  if (userEntry && userRank !== null) {
    entries.push({ rank: userRank, name: userEntry.team_name, pts: userEntry.points, isUser: true });
  }
  if (userRank && userRank < standings.length) {
    const below = standings[userRank];
    if (below) entries.push({ rank: userRank + 1, name: below.team_name, pts: below.points, isUser: false });
  }

  return (
    <Link href="/league" className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 flex flex-col gap-1.5 hover:bg-violet-500/10 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy size={12} className="text-violet-400" />
          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">{t.home_standings || 'STANDINGS'}</span>
        </div>
        <ChevronRight size={10} className="text-gray-600" />
      </div>

      {entries.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {entries.map((e) => (
            <div key={e.rank} className={`flex items-center justify-between text-[9px] ${e.isUser ? 'text-cyan-300 font-bold' : 'text-gray-500'}`}>
              <span className="truncate flex-1">{e.rank}. {e.name}</span>
              <span className="font-mono ml-1">{e.pts}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-[8px] text-gray-600">{t.standings_empty || 'No data'}</span>
      )}
    </Link>
  );
}
