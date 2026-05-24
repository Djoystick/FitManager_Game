'use client';

import React, { useContext } from 'react';
import { Hospital, Dumbbell, Zap, TrendingUp } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

export default function BaseDashboard() {
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  return (
    <div className="flex flex-col flex-1 p-4 gap-6 pb-24 h-full overflow-y-auto custom-scrollbar bg-space-dark">
      {/* Header */}
      <header className="flex flex-col gap-1 border-b border-gray-800 pb-4 mt-4">
        <BackButton />
        <h1 className="text-2xl font-bold font-orbitron text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] uppercase tracking-wider flex items-center gap-2">
          <Hospital className="text-neon-cyan" /> 
          {t.training_base}
        </h1>
        <p className="text-sm text-gray-400">{t.base_desc}</p>
      </header>

      <div className="flex flex-col gap-6">
        {/* Medical Center Card */}
        <div className="bg-black/40 border border-gray-800 rounded-xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-neon-pink/50 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-pink/10 rounded-full blur-2xl group-hover:bg-neon-pink/20 transition-all -mr-10 -mt-10"></div>
          
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 bg-pink-900/30 rounded-lg flex items-center justify-center border border-neon-pink/30 flex-shrink-0 shadow-[inset_0_0_15px_rgba(255,0,100,0.2)]">
              <Zap className="text-neon-pink" size={28} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white font-orbitron uppercase tracking-widest mb-1">{t.medical_center}</h2>
              <p className="text-sm text-gray-400 mb-4">
                {t.med_desc}
              </p>
              
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs font-mono text-gray-500">{t.level} 1</span>
                <button className="text-xs bg-gray-800 text-gray-300 px-4 py-2 rounded uppercase font-bold tracking-widest border border-gray-700 cursor-not-allowed">
                  {t.upgrade_coming_soon}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Training Center Card */}
        <div className="bg-black/40 border border-gray-800 rounded-xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-neon-cyan/50 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-cyan/10 rounded-full blur-2xl group-hover:bg-neon-cyan/20 transition-all -mr-10 -mt-10"></div>
          
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 bg-cyan-900/30 rounded-lg flex items-center justify-center border border-neon-cyan/30 flex-shrink-0 shadow-[inset_0_0_15px_rgba(0,240,255,0.2)]">
              <Dumbbell className="text-neon-cyan" size={28} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white font-orbitron uppercase tracking-widest mb-1">{t.training_center}</h2>
              <p className="text-sm text-gray-400 mb-4">
                {t.train_desc}
              </p>
              
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs font-mono text-gray-500">{t.level} 1</span>
                <button className="text-xs bg-neon-cyan/10 text-neon-cyan px-4 py-2 rounded uppercase font-bold tracking-widest border border-neon-cyan/30 hover:bg-neon-cyan hover:text-black transition-colors shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                  {t.enter_facility}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
