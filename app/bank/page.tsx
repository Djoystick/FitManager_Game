import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { SweatBankClient } from '@/components/SweatBankClient';
import { Droplets } from 'lucide-react';
import type { Metadata, Viewport } from 'next';
import type { ManagerProfileType } from '@/app/actions/economyActions';
import { dict } from '@/lib/dictionaries';
import { verifySession } from '@/lib/session';

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
  last_step_sync: new Date().toISOString().split('T')[0],
};

export default async function BankPage() {
  const cookieStore = await cookies();
  const userId = (await verifySession());
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
        last_step_sync:  data.last_step_sync  || new Date().toISOString().split('T')[0],
      };
    }
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto custom-scrollbar pb-[90px] relative" style={{ background: '#0a0a0f' }}>
      {/* Background — Premium Dark Glassmorphism */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(52,211,153,0.12)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(245,158,11,0.08)_0%,transparent_60%)]" />
      </div>

      {/* Page Header — Glassmorphism */}
      <div className="shrink-0 px-4 pt-4 pb-2 flex items-center gap-3 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center backdrop-blur-md"
             style={{ boxShadow: '0 0 12px rgba(52,211,153,0.15)' }}>
          <Droplets className="text-emerald-400 w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-black uppercase tracking-widest text-white leading-none"
              style={{ textShadow: '0 0 12px rgba(52,211,153,0.3)' }}>
            {t.bank_title}
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
            {t.bank_subtitle}
          </p>
        </div>
      </div>

      {/* Main Client Component */}
      <SweatBankClient initialData={userData} language={language} />
    </div>
  );
}
