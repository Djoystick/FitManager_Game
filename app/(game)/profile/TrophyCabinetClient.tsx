'use client';

import { useState, useEffect } from 'react';
import { Trophy, Medal, Star, Loader2, Crown, Shield } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TrophyItem {
  id: string;
  type: string;
  description: string | null;
  earned_at: string;
}

interface TrophyCabinetClientProps {
  userId: string;
}

const TROPHY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CUP_GOLD: {
    label: 'Cup Winner',
    icon: <Crown className="text-yellow-400" size={16} />,
    color: 'text-yellow-400',
  },
  CUP_SILVER: {
    label: 'Cup Finalist',
    icon: <Medal className="text-gray-400" size={16} />,
    color: 'text-gray-400',
  },
  ACHIEVEMENT: {
    label: 'Achievement',
    icon: <Star className="text-violet-400" size={16} />,
    color: 'text-violet-400',
  },
};

export function TrophyCabinetClient({ userId }: TrophyCabinetClientProps) {
  const [trophies, setTrophies] = useState<TrophyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrophies();
  }, []);

  const loadTrophies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trophy_cabinet')
        .select('*')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      setTrophies(data || []);
    } catch (err) {
      console.error('Failed to load trophies:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="animate-spin text-violet-400" size={16} />
      </div>
    );
  }

  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="text-violet-400" size={14} />
        <h3 className="text-[10px] font-black font-orbitron text-violet-400 uppercase tracking-widest">
          Trophy Cabinet ({trophies.length})
        </h3>
      </div>

      {trophies.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-[10px] text-gray-600">No trophies yet. Win matches and tournaments!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {trophies.map(trophy => {
            const config = TROPHY_CONFIG[trophy.type] || {
              label: trophy.type,
              icon: <Trophy className="text-gray-400" size={14} />,
              color: 'text-gray-400',
            };

            return (
              <div
                key={trophy.id}
                className="glass-card p-2 flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  {config.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-[9px] font-bold ${config.color} uppercase truncate`}>
                    {config.label}
                  </p>
                  {trophy.description && (
                    <p className="text-[8px] text-gray-500 truncate">{trophy.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
