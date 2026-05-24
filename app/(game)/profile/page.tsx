import React from 'react';
import { cookies } from 'next/headers';
import ProfileClient from './ProfileClient';
import { supabase } from '@/lib/supabase';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const tgCookie = cookieStore.get('tg_user_id');
  const sessionUuid = tgCookie?.value;
  
  let isAdmin = false;

  if (sessionUuid) {
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('id', sessionUuid)
      .single();

    if (user && user.telegram_id) {
      const rawAdminIds = process.env.ADMIN_TG_IDS || '';
      const adminIdsArray = rawAdminIds.split(',').map(id => id.trim().toString());
      const currentUserIdStr = String(user.telegram_id).trim();
      isAdmin = adminIdsArray.includes(currentUserIdStr);
    }
  }

  return (
    <>
      <ProfileClient isAdmin={isAdmin} />
    </>
  );
}
