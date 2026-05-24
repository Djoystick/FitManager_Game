import React from 'react';
import { cookies } from 'next/headers';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const tgUserId = cookieStore.get('tg_user_id')?.value;
  
  const rawAdminIds = process.env.ADMIN_TG_IDS || '';
  const adminIdsArray = rawAdminIds.split(',').map(id => id.trim().toString());
  const currentUserIdStr = String(tgUserId || '').trim();
  
  const isAdmin = !!currentUserIdStr && adminIdsArray.includes(currentUserIdStr);

  return <ProfileClient isAdmin={isAdmin} />;
}
