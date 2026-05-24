import React from 'react';
import { cookies } from 'next/headers';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const tgUserId = cookieStore.get('tg_user_id')?.value;
  
  const adminIds = (process.env.ADMIN_TG_IDS || '').split(',').map(id => id.trim());
  const isAdmin = !!tgUserId && adminIds.includes(tgUserId);

  return <ProfileClient isAdmin={isAdmin} />;
}
