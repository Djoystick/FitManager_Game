import React, { useContext } from 'react';
import Link from 'next/link';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

export function LandingPage() {
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict] || dict['en'];
  return (
    <div className="flex flex-col flex-1 min-h-screen bg-[#05060f] text-white overflow-y-auto overflow-x-hidden relative">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none bg-grid-cyan opacity-100" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(147,51,234,0.12)_0%,transparent_100%)]" />

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10 w-full max-w-3xl mx-auto my-auto">
        
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black font-orbitron mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500 drop-shadow-[0_0_15px_rgba(0,240,255,0.4)] uppercase tracking-tight">
            {t.landing_title || 'FitManager Game'}
          </h1>
          <p className="text-xl text-gray-300 font-sans max-w-2xl mx-auto leading-relaxed">
            {t.landing_subtitle}
          </p>
        </div>

        {/* Purpose & Google Fit Explanation */}
        <div className="glass-card p-8 rounded-3xl border border-white/10 mb-12 text-left bg-white/[0.02] backdrop-blur-xl w-full">
          <h2 className="text-2xl font-bold font-orbitron text-violet-400 mb-4 uppercase tracking-wider">
            {t.landing_purpose_title}
          </h2>
          <p className="text-gray-300 mb-6 leading-relaxed">
            {t.landing_purpose_desc}
          </p>
          
          <h2 className="text-2xl font-bold font-orbitron text-cyan-400 mb-4 uppercase tracking-wider mt-8">
            {t.landing_google_fit_title}
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            {t.landing_google_fit_desc}
          </p>
          <ul className="list-disc pl-6 text-gray-400 space-y-2 mb-6">
            <li>{t.landing_gf_bullet1}</li>
            <li>{t.landing_gf_bullet2}</li>
            <li>{t.landing_gf_bullet3}</li>
            <li>{t.landing_gf_bullet4}</li>
          </ul>
        </div>

        {/* Play Button */}
        <a 
          href="https://t.me/FitManagerWeb3_bot/app"
          target="_blank" 
          rel="noopener noreferrer"
          className="relative group overflow-hidden rounded-2xl p-[1px] mb-12 inline-block cursor-pointer active:scale-95 transition-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-violet-500 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="relative px-12 py-4 bg-[#05060f] rounded-2xl flex items-center gap-3">
            <span className="font-black font-orbitron uppercase text-lg tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
              {t.landing_play_btn}
            </span>
          </div>
        </a>

      </main>

      {/* Footer / Links */}
      <footer className="w-full py-8 border-t border-white/5 relative z-10 text-center">
        <div className="flex flex-wrap justify-center gap-6 mb-4">
          <Link href="/privacy" className="text-sm text-gray-500 hover:text-cyan-400 transition-colors uppercase tracking-wider font-bold">
            {t.landing_privacy}
          </Link>
          <Link href="/terms" className="text-sm text-gray-500 hover:text-violet-400 transition-colors uppercase tracking-wider font-bold">
            {t.landing_terms}
          </Link>
        </div>
        <p className="text-xs text-gray-600">
          {t.landing_copyright?.replace('{year}', String(new Date().getFullYear())) || `© ${new Date().getFullYear()} FitManager Game. All rights reserved.`}
        </p>
      </footer>
    </div>
  );
}
