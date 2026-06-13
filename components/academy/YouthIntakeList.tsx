'use client';

import React, { useTransition } from 'react';
import { signYouthIntake } from '@/app/actions/scoutingActions';
import toast from 'react-hot-toast';

interface YouthIntake {
  id: string;
  name: string;
  age: number;
  position: string;
  ovr: number;
  potential_limit: number;
  traits: string[];
}

export function YouthIntakeList({ intakes }: { intakes: YouthIntake[] }) {
  const [isPending, startTransition] = useTransition();

  const handleSign = (id: string) => {
    startTransition(async () => {
      const res = await signYouthIntake(id);
      if (res.success) {
        toast.success(`Successfully signed player!`);
        window.dispatchEvent(new Event('balanceUpdated'));
      } else {
        toast.error(res.error || 'Failed to sign player.');
      }
    });
  };

  if (!intakes || intakes.length === 0) {
    return (
      <div className="bg-black/40 border border-gray-800 rounded-xl p-6 text-center text-gray-500">
        No youth intakes available right now. Check back next season!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-bold text-lg text-white">Youth Academy Intakes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {intakes.map(intake => (
          <div key={intake.id} className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-black text-white text-lg">{intake.name}</h4>
                <p className="text-xs text-gray-400">{intake.age} YO • {intake.position}</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xl font-black text-cyan-400">{intake.ovr}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">OVR</span>
              </div>
            </div>

            <div className="flex gap-4 items-center">
               <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">POTENTIAL</span>
                  <span className="text-sm font-black text-pink-400">{intake.potential_limit}</span>
               </div>
               {intake.traits && intake.traits.length > 0 && (
                 <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">TRAITS</span>
                    <span className="text-xs text-violet-400 font-bold">{intake.traits.join(', ')}</span>
                 </div>
               )}
            </div>

            <button
              onClick={() => handleSign(intake.id)}
              disabled={isPending}
              className="mt-2 w-full py-2 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white font-black text-xs uppercase tracking-widest rounded-lg transition-all"
            >
              {isPending ? 'Signing...' : 'Sign for 2000 FC'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
