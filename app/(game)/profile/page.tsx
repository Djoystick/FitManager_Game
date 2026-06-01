import React from 'react';
import { cookies } from 'next/headers';
import ProfileClient from './ProfileClient';
import { supabase } from '@/lib/supabase';
import { getUserAchievements } from '@/app/actions/achievementActions';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const tgCookie = cookieStore.get('tg_user_id');
  const sessionUuid = tgCookie?.value;
  
  let isAdmin = false;
  let user = null;

  let fcBalance = 0;
  let team = null;
  
  let achievements = [];
  let stats = [];

  if (sessionUuid) {
    const [{ data: userRes }, { data: teamRes }, achRes] = await Promise.all([
      supabase
        .from('users')
        .select('telegram_id, balance_fancoins')
        .eq('id', sessionUuid)
        .single(),
      supabase
        .from('teams')
        .select('name, logo_url')
        .eq('user_id', sessionUuid)
        .single(),
      getUserAchievements()
    ]);

    if (userRes) {
      user = userRes;
      fcBalance = userRes.balance_fancoins || 0;
      if (userRes.telegram_id) {
        const rawAdminIds = process.env.ADMIN_TG_IDS || '';
        const adminIdsArray = rawAdminIds.split(',').map(id => id.trim().toString());
        const currentUserIdStr = String(userRes.telegram_id).trim();
        isAdmin = adminIdsArray.includes(currentUserIdStr);
      }
    }
    
    if (teamRes) {
      team = teamRes;
    }
    
    if (achRes.success) {
      achievements = achRes.achievements;
      stats = achRes.stats;
    }
  }

  return (
    <>
      <ProfileClient 
        isAdmin={isAdmin} 
        initialTeamName={team?.name || 'Unknown'} 
        initialLogoUrl={team?.logo_url || null}
        fcBalance={user?.balance_fancoins || 0}
        initialAchievements={achievements}
        globalStats={stats}
      />
    </>
  );
}
