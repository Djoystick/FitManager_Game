import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ProfileClient } from '@/components/ProfileClient';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('tg_user_id')?.value;
  const language = cookieStore.get('language')?.value || 'en';

  if (!userId) {
    redirect('/');
  }

  // Fetch team info and user info
  const [{ data: user }, { data: team }] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('teams').select('*').eq('user_id', userId).single()
  ]);

  return (
    <main className="min-h-screen bg-[#060913] text-white flex flex-col font-inter pb-20">
      <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto">
        <ProfileClient 
          initialTeamName={team?.name || 'Unknown'} 
          fcBalance={user?.balance_fancoins || 0}
          language={language}
        />
      </div>
    </main>
  );
}
