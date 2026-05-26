import React from 'react';
import { SeedLeagueButton } from '@/components/admin/SeedLeagueButton';
import { ScheduleButtons } from '@/components/admin/ScheduleButtons';
import { HardResetButton } from '@/components/admin/HardResetButton';
import { ShieldAlert, DatabaseBackup, Lock, AlertOctagon, CalendarSync } from 'lucide-react';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { BackButton } from '@/components/ui/BackButton';

export default async function AdminDashboard() {
  const cookieStore = await cookies();
  const tgCookie = cookieStore.get('tg_user_id');
  const sessionUuid = tgCookie?.value;

  // 1. Check Authentication
  if (!sessionUuid) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-6 h-full text-center bg-space-dark">
        <Lock className="text-gray-500 w-16 h-16 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2 font-orbitron">Access Denied</h1>
        <p className="text-sm text-gray-400 max-w-sm">
          Please open the app inside Telegram to establish a secure session.
        </p>
      </div>
    );
  }

  // 2. Check Authorization (RBAC)
  const { data: user } = await supabase
    .from('users')
    .select('telegram_id')
    .eq('id', sessionUuid)
    .single();

  const rawAdminIds = process.env.ADMIN_TG_IDS || '';
  const adminIdsArray = rawAdminIds.split(',').map(id => id.trim().toString());
  const currentUserIdStr = user?.telegram_id ? String(user.telegram_id).trim() : '';
  
  if (!currentUserIdStr || !adminIdsArray.includes(currentUserIdStr)) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-6 h-full text-center bg-space-dark">
        <AlertOctagon className="text-red-500 w-16 h-16 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
        <h1 className="text-xl font-bold text-red-500 mb-2 font-orbitron">Forbidden</h1>
        <p className="text-sm text-gray-400 max-w-sm">
          Your Telegram account does not have Admin privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar bg-space-dark">
      {/* Header */}
      <header className="flex flex-col gap-2 border-b border-gray-800 pb-4 mt-4">
        <BackButton />
        <h1 className="text-2xl font-bold font-orbitron text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] uppercase tracking-wider flex items-center gap-3">
          <ShieldAlert className="text-red-500" size={28} /> 
          Developer Console
        </h1>
        <p className="text-sm text-gray-400">Restricted access. Use these tools to manipulate the game state.</p>
      </header>

      {/* Admin Tools Section */}
      <section className="bg-black/40 border border-gray-800 rounded-xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col gap-6 max-w-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-neon-cyan/10 rounded-full flex items-center justify-center border border-neon-cyan/30 flex-shrink-0">
            <DatabaseBackup className="text-neon-cyan" size={24} />
          </div>
          <div>
            <h2 className="font-bold text-white mb-2 text-lg">Bot League Seeder</h2>
            <p className="text-sm text-gray-400 mb-6">
              This action will procedurally generate <strong className="text-white">13 Bot Teams</strong>, 
              insert <strong className="text-white">143 Players</strong> (11 per team), and initialize 
              their standings in the global league. Use this to simulate a populated environment for testing the Match Engine.
            </p>
            <SeedLeagueButton />
            <div className="mt-4 border-t border-gray-800 pt-4">
              <p className="text-sm text-gray-400 mb-2">Delete your current team and regenerate players with traits:</p>
              <HardResetButton />
            </div>
          </div>
        </div>
      </section>

      {/* Match Engine Section */}
      <section className="bg-black/40 border border-gray-800 rounded-xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col gap-6 max-w-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-neon-purple/10 rounded-full flex items-center justify-center border border-neon-purple/30 flex-shrink-0">
            <CalendarSync className="text-neon-purple" size={24} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-white mb-2 text-lg">Live Match Engine</h2>
            <p className="text-sm text-gray-400 mb-6">
              Generate the global <strong className="text-white">Round-Robin Schedule</strong> and manually fast-forward time to simulate matches round-by-round.
            </p>
            <ScheduleButtons />
          </div>
        </div>
      </section>
    </div>
  );
}
