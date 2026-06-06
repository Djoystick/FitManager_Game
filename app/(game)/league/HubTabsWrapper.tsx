'use client';

import { useState } from 'react';
import { SubNavTabs } from '@/components/ui/SubNavTabs';
import { HubSocialClient } from './HubSocialClient';
import { Trophy, Medal, Loader2, TrendingUp, TrendingDown, Users, Globe, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// HubTabsWrapper — Client wrapper for HUB page tab navigation.
// Primary tabs: COMPETITIONS | SOCIAL | RANKINGS | SEARCH
// ─────────────────────────────────────────────────────────────────────────────

interface StandingRow {
  id: string;
  team_id: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

interface HubTabsWrapperProps {
  standings: StandingRow[];
  currentTeamId: string;
  tierName: string;
  groupName: string;
  isFilling: boolean;
  isTransferWindow: boolean;
  userRank: number;
  totalTeams: number;
  friendlyMatchesPlayed: number;
  userId: string;
}

type HubTab = 'competitions' | 'social' | 'rankings' | 'search';

export function HubTabsWrapper({
  standings, currentTeamId, tierName, groupName,
  isFilling, isTransferWindow, userRank, totalTeams,
  friendlyMatchesPlayed, userId,
}: HubTabsWrapperProps) {
  const [activeTab, setActiveTab] = useState<HubTab>('competitions');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header card */}
      <header className="flex-shrink-0 p-3 pb-0 relative z-10">
        <div className="glass-card-violet relative overflow-hidden p-3">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl glass-card flex items-center justify-center flex-shrink-0">
              <Trophy className="text-violet-400 drop-shadow-[0_0_8px_rgba(147,51,234,0.8)]" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-black font-orbitron text-white uppercase tracking-wider truncate">{tierName}</h1>
              <p className="text-[9px] text-violet-400/70 uppercase tracking-widest">{groupName}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isFilling ? (
                <span className="flex items-center gap-1 text-[8px] font-bold text-amber-400
                                 bg-amber-900/20 px-2 py-1 rounded-full border border-amber-500/40">
                  <Loader2 className="animate-spin" size={8} />
                  {standings.length}/14
                </span>
              ) : isTransferWindow ? (
                <span className="text-[8px] font-bold text-pink-400
                                 bg-pink-900/20 px-2 py-1 rounded-full border border-pink-500/40">
                  WINDOW
                </span>
              ) : null}
              {userRank > 0 && (
                <div className="text-right">
                  <div className="text-[7px] text-gray-600 uppercase tracking-widest">Your rank</div>
                  <div className="text-sm font-black font-orbitron text-white">#{userRank}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Primary SubNav */}
      <div className="flex-shrink-0 py-2 relative z-10">
        <SubNavTabs
          tabs={[
            { id: 'competitions', label: 'LEAGUE'   },
            { id: 'social',       label: 'WOOF 🐾'   },
            { id: 'rankings',     label: 'GLOBAL'   },
            { id: 'search',       label: 'SEARCH'   },
          ]}
          active={activeTab}
          onChange={(id) => setActiveTab(id as HubTab)}
          accent="violet"
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-28 relative z-10">

        {/* ── COMPETITIONS: Full League Table ─────────────────────── */}
        {activeTab === 'competitions' && (
          <div className="px-3">
            <div className="glass-card overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[28px_1fr_52px_52px_36px] bg-white/5 border-b border-white/5 px-3 py-2.5">
                <div className="text-[8px] text-gray-600 uppercase font-bold font-orbitron text-center">#</div>
                <div className="text-[8px] text-gray-600 uppercase font-bold font-orbitron">Club</div>
                <div className="text-[8px] text-gray-600 uppercase font-bold font-orbitron text-center">W·D·L</div>
                <div className="text-[8px] text-gray-500 uppercase font-bold font-orbitron text-center">GF·GA</div>
                <div className="text-[8px] text-white uppercase font-black font-orbitron text-center">PTS</div>
              </div>

              {standings.length > 0 ? standings.map((row, index) => {
                const isMe         = row.team_id === currentTeamId;
                const rank         = index + 1;
                const isPromotion  = rank <= 3;
                const isRelegation = rank >= 12;

                return (
                  <div
                    key={row.id}
                    className={`
                      grid grid-cols-[28px_1fr_52px_52px_36px] px-3 py-2.5 items-center
                      border-b border-white/[0.04] last:border-b-0 relative
                      ${isMe
                        ? 'bg-violet-500/8 border-l-2 border-l-violet-500'
                        : `border-l-2 ${isPromotion ? 'border-l-emerald-500/50' : isRelegation ? 'border-l-red-500/50' : 'border-l-transparent'}`
                      }
                    `}
                  >
                    <div className="text-center">
                      {rank === 1 ? <Medal className="text-yellow-400 mx-auto" size={14} /> :
                       rank === 2 ? <Medal className="text-gray-400 mx-auto" size={14} /> :
                       rank === 3 ? <Medal className="text-orange-500 mx-auto" size={14} /> :
                       <span className="text-[10px] text-gray-600 font-mono">{rank}</span>}
                    </div>
                    <div className={`flex items-center gap-1 min-w-0 ${isMe ? 'text-violet-300' : 'text-white'}`}>
                      <span className="text-[11px] font-bold truncate max-w-[100px]">{row.team_name}</span>
                      {isMe && (
                        <span className="text-[7px] bg-violet-500 text-white font-black px-1 py-0.5 rounded-full flex-shrink-0">YOU</span>
                      )}
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-mono font-bold">
                        <span className="text-emerald-400">{row.wins}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-gray-400">{row.draws}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-red-400">{row.losses}</span>
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-mono text-gray-500">
                        <span className="text-emerald-400/80">{row.goals_for}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-red-400/80">{row.goals_against}</span>
                      </span>
                    </div>
                    <div className={`text-center text-sm font-black font-orbitron ${isMe ? 'text-violet-300' : 'text-white'}`}>
                      {row.points}
                    </div>
                  </div>
                );
              }) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                  <Trophy className="mb-3 opacity-30" size={32} />
                  <p className="font-bold text-sm text-violet-400/60">League is filling up...</p>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50 border border-emerald-500/70" />
                <span className="text-[8px] text-gray-600 uppercase tracking-widest">Promotion</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500/50 border border-red-500/70" />
                <span className="text-[8px] text-gray-600 uppercase tracking-widest">Relegation</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Users size={10} className="text-gray-700" />
                <span className="text-[8px] text-gray-600">{totalTeams} teams</span>
              </div>
            </div>
          </div>
        )}

        {/* ── SOCIAL: WOOF Feed ─────────────────────────────────── */}
        {activeTab === 'social' && (
          <div className="pt-2">
            <HubSocialClient />
          </div>
        )}

        {/* ── GLOBAL RANKINGS (placeholder) ────────────────────── */}
        {activeTab === 'rankings' && (
          <div className="px-3 pt-2">
            <div className="glass-card p-6 flex flex-col items-center gap-3 text-center">
              <Globe className="text-cyan-400/50" size={36} />
              <h3 className="text-sm font-black font-orbitron text-white uppercase tracking-wider">Global Rankings</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Coming in the next season update</p>
            </div>
          </div>
        )}

        {/* ── SEARCH (placeholder) ─────────────────────────────── */}
        {activeTab === 'search' && (
          <div className="px-3 pt-2">
            <div className="glass-card p-6 flex flex-col items-center gap-3 text-center">
              <BarChart2 className="text-violet-400/50" size={36} />
              <h3 className="text-sm font-black font-orbitron text-white uppercase tracking-wider">Search Zone</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Find any team or manager</p>
              <input
                type="text"
                placeholder="Search teams..."
                className="w-full bg-black/40 border border-white/10 text-white text-xs
                           rounded-xl px-3 py-2 outline-none focus:border-cyan-500/40
                           placeholder:text-gray-700 font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
