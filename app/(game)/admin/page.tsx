import React from 'react';
import { SeedLeagueButton } from '@/components/admin/SeedLeagueButton';
import { ShieldAlert, DatabaseBackup, Lock, AlertOctagon } from 'lucide-react';
import { cookies } from 'next/headers';

export default async function AdminDashboard() {
  const cookieStore = await cookies();
  const tgCookie = cookieStore.get('tg_user_id');
  const tgUserId = tgCookie?.value;

  // 1. Check Authentication
  if (!tgUserId) {
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
  const rawAdminIds = process.env.ADMIN_TG_IDS || '';
  const adminIdsArray = rawAdminIds.split(',').map(id => id.trim().toString());
  const currentUserIdStr = String(tgUserId || '').trim();
  
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
          </div>
        </div>
      </section>
    </div>
  );
}
