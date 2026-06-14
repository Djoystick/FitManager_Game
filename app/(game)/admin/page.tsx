import React from 'react';
import { ShieldAlert, Lock, AlertOctagon } from 'lucide-react';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { BackButton } from '@/components/ui/BackButton';
import { AdminConsoleClient } from '@/components/admin/AdminConsoleClient';
import { verifySession } from '@/lib/session';

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
        <AlertOctagon className="text-red-500 w-16 h-16 mb-4" />
        <h1 className="text-xl font-bold text-red-500 mb-2 font-orbitron">Forbidden</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar bg-space-dark">
      <header className="flex flex-col gap-2 border-b border-gray-800 pb-4 mt-4">
        <BackButton />
        <h1 className="text-2xl font-bold font-orbitron text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] uppercase tracking-wider flex items-center gap-3">
          <ShieldAlert className="text-red-500" size={28} /> 
          Developer Console
        </h1>
        <p className="text-sm text-gray-400">Restricted access. Use these tools to manipulate the game state.</p>
      </header>

      <AdminConsoleClient userId={sessionUuid} />
    </div>
  );
}
