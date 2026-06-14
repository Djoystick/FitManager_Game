import React from 'react';
import { ScoutPlayerButton } from '@/components/academy/ScoutPlayerButton';
import { GraduationCap, Users } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { YouthIntakeList } from '@/components/academy/YouthIntakeList';
import { verifySession } from '@/lib/session';

export default async function AcademyDashboard() {
  const cookieStore = await cookies();
  const tgUserId = (await verifySession());

  if (!tgUserId) {
    redirect('/profile'); // Fallback if no auth
  }

  // Count how many players the user currently has
  const { data: teamData } = await supabase
    .from('teams')
    .select('id')
    .eq('user_id', tgUserId)
    .single();

  let playerCount = 0;
  let intakes: any[] = [];
  if (teamData) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamData.id);
    playerCount = count || 0;

    const { data: intakesData } = await supabase
      .from('youth_intakes')
      .select('*')
      .eq('team_id', teamData.id)
      .order('created_at', { ascending: false });
    
    if (intakesData) intakes = intakesData;
  }

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-gray-800 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider flex items-center gap-2">
            <GraduationCap className="text-neon-cyan" /> 
            Youth Academy
          </h1>
          <p className="text-sm text-gray-400">Scout and recruit young talents for your club.</p>
        </div>
      </header>

      {/* Info Section */}
      <section className="bg-black/40 border border-gray-800 rounded-xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-neon-purple/10 rounded-full flex items-center justify-center border border-neon-purple/30 flex-shrink-0">
            <Users className="text-neon-purple" size={24} />
          </div>
          <div>
            <h2 className="font-bold text-white mb-1">Squad Roster</h2>
            <p className="text-sm text-gray-400">
              You currently have <span className="text-white font-bold">{playerCount}</span> players in your club. 
              Scouting new players will automatically assign them to your bench, allowing you to rotate exhausted starters.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Scouting Area */}
      <section className="flex-1 flex flex-col items-center justify-center">
        <ScoutPlayerButton />
      </section>

      {/* Youth Intakes */}
      <section className="mt-4">
         <YouthIntakeList intakes={intakes} />
      </section>
    </div>
  );
}
