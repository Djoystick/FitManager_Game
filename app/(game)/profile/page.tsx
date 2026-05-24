import React from 'react';
import { cookies } from 'next/headers';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const tgCookie = cookieStore.get('tg_user_id');
  
  const rawAdminIds = process.env.ADMIN_TG_IDS || '';
  const adminIdsArray = rawAdminIds.split(',').map(id => id.trim().toString());
  const currentUserIdStr = String(tgCookie?.value || '').trim();
  
  const isAdmin = !!currentUserIdStr && adminIdsArray.includes(currentUserIdStr);

  return (
    <>
      <ProfileClient isAdmin={isAdmin} />
      <div className="text-center pb-4">
        <span className="text-xs text-gray-600 font-mono">
          Debug Server ID: {currentUserIdStr || 'none'} | Admin: {isAdmin ? 'Yes' : 'No'}
        </span>
      </div>
    </>
  );
}
