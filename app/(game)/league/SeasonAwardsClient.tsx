'use client';

import { useState, useEffect } from 'react';
import { Trophy, Medal, Star, Loader2, Shield, Swords } from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SeasonAward {
  id: string;
  award_type: string;
  player_id: string;
  team_id: string;
  user_id: string;
  created_at: string;
  player_name?: string;
  team_name?: string;
}

interface SeasonAwardsClientProps {
  userId: string;
  teamId: string;
}

const AWARD_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  GOLDEN_BOOT: {
    label: 'Golden Boot',
    icon: <Medal className="text-yellow-400" size={16} />,
    color: 'text-yellow-400',
  },
  GOLDEN_GLOVE: {
    label: 'Golden Glove',
    icon: <Shield className="text-emerald-400" size={16} />,
    color: 'text-emerald-400',
  },
  MVP: {
    label: 'MVP',
    icon: <Star className="text-violet-400" size={16} />,
    color: 'text-violet-400',
  },
};

export function SeasonAwardsClient({ userId, teamId }: SeasonAwardsClientProps) {
  const [awards, setAwards] = useState<SeasonAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAwards();
  }, []);

  const loadAwards = async () => {
    setLoading(true);
    try {
      // Get the latest finished instance
      const { data: instance } = await supabase
        .from('league_instances')
        .select('id')
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!instance) {
        setLoading(false);
        return;
      }

      // Get awards for this season
      const { data: awardsData } = await supabase
        .from('season_awards')
        .select('*')
        .eq('season_id', instance.id);

      if (!awardsData || awardsData.length === 0) {
        setLoading(false);
        return;
      }

      // Enrich with player and team names
      const playerIds = awardsData.map(a => a.player_id);
      const teamIds = awardsData.map(a => a.team_id);

      const [{ data: playersData }, { data: teamsData }] = await Promise.all([
        supabase.from('players').select('id, name').in('id', playerIds),
        supabase.from('teams').select('id, name').in('id', teamIds),
      ]);

      const playerNames: Record<string, string> = {};
      const teamNames: Record<string, string> = {};
      if (playersData) playersData.forEach(p => { playerNames[p.id] = p.name; });
      if (teamsData) teamsData.forEach(t => { teamNames[t.id] = t.name; });

      const enriched = awardsData.map(a => ({
        ...a,
        player_name: playerNames[a.player_id] || 'Unknown',
        team_name: teamNames[a.team_id] || 'Unknown',
      }));

      setAwards(enriched);
    } catch (err) {
      console.error('Failed to load awards:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-violet-400" size={24} />
      </div>
    );
  }

  if (awards.length === 0) {
    return (
      <div className="glass-card p-6 flex flex-col items-center gap-3 text-center">
        <Trophy className="text-gray-600" size={36} />
        <h3 className="text-sm font-black font-orbitron text-gray-500 uppercase">No Awards Yet</h3>
        <p className="text-[10px] text-gray-600">Awards are given at the end of each season</p>
      </div>
    );
  }

  return (
    <div className="px-3">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="text-violet-400" size={20} />
        <h2 className="text-sm font-black font-orbitron text-white uppercase">Season Awards</h2>
      </div>

      <div className="space-y-3">
        {awards.map(award => {
          const config = AWARD_CONFIG[award.award_type] || {
            label: award.award_type,
            icon: <Trophy className="text-gray-400" size={16} />,
            color: 'text-gray-400',
          };

          return (
            <motion.div
              key={award.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl glass-card flex items-center justify-center flex-shrink-0">
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-xs font-black font-orbitron ${config.color} uppercase tracking-wider`}>
                    {config.label}
                  </h3>
                  <p className="text-[11px] text-white font-bold truncate">{award.player_name}</p>
                  <p className="text-[9px] text-gray-500 uppercase">{award.team_name}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-[8px] text-gray-600 uppercase">Reward</span>
                  <span className="text-[10px] text-violet-400 font-bold">+200 SP</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Perk explanation */}
      <div className="glass-card p-3 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Star className="text-violet-400" size={12} />
          <span className="text-[9px] text-violet-400 font-bold uppercase">Season Award Winner Perk</span>
        </div>
        <p className="text-[10px] text-gray-500">
          Award winners receive the <span className="text-white font-bold">SEASON_AWARD_WINNER</span> trait, 
          providing a permanent <span className="text-emerald-400 font-bold">+2%</span> stat bonus in matches.
        </p>
      </div>
    </div>
  );
}
