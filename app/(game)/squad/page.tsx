import React from 'react';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/authGuard';
import { dict } from '@/lib/dictionaries';
import { ScreenGuide } from '@/components/ui/ScreenGuide';

import { SquadTabs } from '@/components/squad/SquadTabs';
import { verifySession } from '@/lib/session';

export default async function SquadPage() {
  const team = await requireTeam();
  
  if (!team) return null; // handled by requireTeam redirect

  const cookieStore = await cookies();
  const userId = (await verifySession()) as string;
  const language = cookieStore.get('fitmanager_lang')?.value || 'en';
  const t = dict[language as keyof typeof dict];

  // Fetch Players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', team.id)
    .order('ovr', { ascending: false });

  return (
    <div className="flex flex-col flex-1 p-4 gap-4 pb-24 h-full overflow-y-auto custom-scrollbar relative"
         style={{ background: '#0a0a0f' }}>
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_0%,rgba(147,51,234,0.12)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(0,240,255,0.08)_0%,transparent_60%)]" />
      </div>
      
      {/* Tight Header */}
      <header className="flex flex-col gap-1 pb-2 relative z-10">
        <h1 className="text-xl font-black font-orbitron text-white uppercase tracking-wider"
            style={{ textShadow: '0 0 20px rgba(0,240,255,0.3)' }}>
          {t.squad_title.replace('{name}', team.name)}
        </h1>
      </header>

      <SquadTabs initialPlayers={players || []} teamId={team.id} userId={userId} />

      <ScreenGuide 
        screenName="squad" 
        title={t.squad_management} 
        content={t.squad_management_desc} 
      />
    </div>
  );
}
