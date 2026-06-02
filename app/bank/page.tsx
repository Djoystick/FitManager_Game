import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { SweatBankClient } from '@/components/SweatBankClient';
import { Droplets } from 'lucide-react';
import type { Metadata, Viewport } from 'next';
import type { ManagerProfileType } from '@/app/actions/economyActions';
import { dict } from '@/lib/dictionaries';

export const viewport: Viewport = {
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  title: 'Sweat Bank — FitManager',
  description: 'Convert your real-world fitness activity into in-game currencies.',
};

// Default data shape if the user has no W2E data yet
const DEFAULT_DATA = {
  manager_profile: 'runner' as ManagerProfileType,
  daily_steps:    0,
  sweat_points:   0,
  cardio_coin:    0,
  fitness_coin:   0,
  ball_coin:      0,
  strength_coin:  0,
};

export default async function BankPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('tg_user_id')?.value;
  const language = cookieStore.get('fitmanager_lang')?.value || 'en';
  const t = dict[language as keyof typeof dict];

  let userData = DEFAULT_DATA;

  if (userId) {
    const { data, error } = await supabase
      .from('users')
      .select(
        'manager_profile, daily_steps, sweat_points, cardio_coin, fitness_coin, ball_coin, strength_coin, last_step_sync'
      )
      .eq('id', userId)
      .single();

    if (!error && data) {
      let steps = data.daily_steps ?? 0;
      if (data.last_step_sync) {
        const syncDate = new Date(data.last_step_sync).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        if (syncDate !== today) {
          steps = 0;
        }
      }

      userData = {
        manager_profile: (data.manager_profile ?? 'runner') as ManagerProfileType,
        daily_steps:     steps,
        sweat_points:    data.sweat_points    ?? 0,
        cardio_coin:     data.cardio_coin     ?? 0,
        fitness_coin:    data.fitness_coin    ?? 0,
        ball_coin:       data.ball_coin       ?? 0,
        strength_coin:   data.strength_coin   ?? 0,
      };
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col bg-space-dark">
      {/* Page Header */}
      <div className="shrink-0 px-4 pt-4 pb-2 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
          <Droplets className="text-neon-green w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-black uppercase tracking-widest text-white leading-none">
            {t.bank_title}
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
            {t.bank_subtitle}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-neon-green/10 border border-neon-green/20 rounded-full px-3 py-1">
          <Droplets className="text-neon-green w-3 h-3" />
          <span className="text-xs font-black text-neon-green font-orbitron">
            {userData.sweat_points.toLocaleString()} SP
          </span>
        </div>
      </div>

      {/* Main Client Component */}
      <SweatBankClient initialData={userData} language={language} />
    </div>
  );
}
