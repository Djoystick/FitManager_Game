'use client';

import { useState, useEffect } from 'react';
import { Trophy, Medal, Star, Loader2, Crown } from 'lucide-react';
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

const TROPHY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; glow: string; border: string; textGlow: string }> = {
  CUP_GOLD: {
    label: 'Cup Winner',
    icon: <Crown size={16} />,
    color: 'text-amber-300',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
    border: 'border-amber-500/40',
    textGlow: '0 0 12px rgba(245,158,11,0.6)',
  },
  CUP_SILVER: {
    label: 'Cup Finalist',
    icon: <Medal size={16} />,
    color: 'text-gray-300',
    glow: 'shadow-[0_0_12px_rgba(209,213,219,0.25)]',
    border: 'border-gray-400/30',
    textGlow: '0 0 8px rgba(209,213,219,0.4)',
  },
  ACHIEVEMENT: {
    label: 'Achievement',
    icon: <Star size={16} />,
    color: 'text-violet-300',
    glow: 'shadow-[0_0_12px_rgba(139,92,246,0.3)]',
    border: 'border-violet-500/30',
    textGlow: '0 0 8px rgba(139,92,246,0.5)',
  },
};

export function TrophyCabinetClient({ userId }: TrophyCabinetClientProps) {
  const [trophies, setTrophies] = useState<TrophyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTrophies(); }, []);

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
    } catch (err) { console.error('Failed to load trophies:', err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="animate-spin text-amber-400" size={16} />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-3 backdrop-blur-xl"
         style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(255,255,255,0.02) 100%)' }}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
      
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="text-amber-400" size={14} style={{ textShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
        <h3 className="text-[10px] font-black font-orbitron text-amber-300 uppercase tracking-widest"
            style={{ textShadow: '0 0 8px rgba(245,158,11,0.3)' }}>
          Trophy Cabinet ({trophies.length})
        </h3>
      </div>

      {trophies.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-[10px] text-gray-500">No trophies yet. Win matches and tournaments!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {trophies.map(trophy => {
            const config = TROPHY_CONFIG[trophy.type] || {
              label: trophy.type,
              icon: <Trophy className="text-gray-400" size={14} />,
              color: 'text-gray-400',
              glow: '',
              border: 'border-white/10',
              textGlow: 'none',
            };

            return (
              <div key={trophy.id}
                   className={`relative overflow-hidden p-2 flex items-center gap-2 rounded-xl border backdrop-blur-md transition-all duration-300 ${config.border} ${config.glow}`}
                   style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 backdrop-blur-md ${config.border}`}
                     style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {config.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-[9px] font-bold ${config.color} uppercase truncate`}
                     style={{ textShadow: config.textGlow }}>
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
