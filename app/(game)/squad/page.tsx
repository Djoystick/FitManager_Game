import React from 'react';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/authGuard';

import { SquadTabs } from '@/components/squad/SquadTabs';

export default async function SquadPage() {
  const team = await requireTeam();
  
  if (!team) return null; // handled by requireTeam redirect

  const cookieStore = await cookies();
  const userId = cookieStore.get('tg_user_id')?.value as string;

  // Fetch Players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', team.id)
    .order('ovr', { ascending: false });

  return (
    <div className="flex flex-col flex-1 p-4 gap-4 pb-24 h-full overflow-y-auto custom-scrollbar">
      {/* Tight Header */}
      <header className="flex flex-col gap-1 pb-2">
        <h1 className="text-xl font-bold font-orbitron text-white uppercase tracking-wider">
          {team.name} Squad
        </h1>
      </header>

      <SquadTabs initialPlayers={players || []} teamId={team.id} userId={userId} />
    </div>
  );
}
