import React from 'react';
import { supabase } from '@/lib/supabase';
import { SquadManager } from '@/components/squad/SquadManager';

export default async function SquadPage({ searchParams }: { searchParams: Promise<{ userId?: string }> | { userId?: string } }) {
  // Await searchParams for Next.js 15+ compatibility
  const resolvedParams = await searchParams;
  const userId = resolvedParams.userId;

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4 text-center">
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.3)]">
          <h2 className="font-bold text-lg mb-1">Unauthorized</h2>
          <p className="text-sm">Cannot view squad without a valid userId in query parameters.</p>
        </div>
      </div>
    );
  }

  // Fetch Team ID
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name')
    .eq('user_id', userId)
    .single();

  if (teamError || !team) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4 text-center">
        <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-500 p-4 rounded-lg shadow-[0_0_15px_rgba(234,179,8,0.3)]">
          <h2 className="font-bold text-lg mb-1">No Franchise Detected</h2>
          <p className="text-sm">Please complete onboarding to create your team.</p>
        </div>
      </div>
    );
  }

  // Fetch Players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', team.id)
    .order('ovr', { ascending: false });

  return (
    <div className="flex flex-col flex-1 p-4 gap-8 pb-24 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col gap-1 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider">
          Squad Builder
        </h1>
        <p className="text-sm text-neon-cyan font-bold drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
          {team.name}
        </p>
      </header>

      <SquadManager initialPlayers={players || []} teamId={team.id} />
    </div>
  );
}
