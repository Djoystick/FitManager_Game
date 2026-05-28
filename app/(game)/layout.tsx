import React from 'react';
import { requireTeam } from '@/lib/authGuard';

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  // Enforce that the user has a franchise/team created before accessing game routes
  await requireTeam();

  return <>{children}</>;
}
