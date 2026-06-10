'use client';

import Link from 'next/link';
import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';

export default function TermsPage() {
  const { language } = useContext(LanguageContext);

  if (language === 'ru') {
    return (
      <div className="flex flex-col flex-1 min-h-screen bg-[#0B0F19] items-center p-6 relative overflow-hidden">
        {/* Background Orbs */}
        <div className="fixed top-[-10%] left-[-20%] w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neon-cyan/5 via-[#0B0F19]/80 to-[#0B0F19] pointer-events-none" />
        
        <div className="w-full max-w-2xl z-10 flex flex-col pt-10 pb-20">
          <Link 
            href="/onboarding" 
            className="text-neon-cyan hover:text-white font-orbitron text-sm mb-8 flex items-center gap-2 transition-colors w-fit"
          >
            ← Назад
          </Link>
          <h1 className="text-3xl font-black text-white mb-8 tracking-wide font-orbitron drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            Пользовательское Соглашение
          </h1>
          <div className="bg-black/60 backdrop-blur-md border border-gray-800 p-6 md:p-8 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-8 text-gray-300 font-inter text-sm md:text-base leading-relaxed">
            <div className="text-center pb-4 border-b border-gray-800/50">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Дата вступления в силу: 10 июня 2026</p>
            </div>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">1.</span> Принятие Условий
              </h2>
              <p>Открывая и играя в FitManager ("Игра"), вы соглашаетесь с настоящими Условиями использования. Если вы не согласны, не используйте Игру.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">2.</span> Данные о физической активности (Google Fit)
              </h2>
              <p>FitManager использует данные о физической активности (например, количество шагов), полученные из Google Fit, для вознаграждения игроков. Подключая свою учетную запись Google Fit, вы соглашаетесь предоставить нам доступ к этим данным только для чтения в целях игрового прогресса. Мы не являемся медицинским приложением, и представленные данные не должны рассматриваться как медицинские рекомендации.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">3.</span> Честная игра и Анти-чит
              </h2>
              <p>Использование сторонних ботов, эмуляторов шагов (например, для искусственного накручивания шагов Google Fit), автокликеров или любого программного обеспечения, предназначенного для манипулирования Sweat Points или результатами матчей, строго запрещено. Нарушители будут заблокированы без компенсации.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">4.</span> Виртуальные активы и экономика
              </h2>
              <p>Внутриигровая валюта (FanCoins) и цифровые активы (игроки) не имеют гарантированной реальной ценности. Разработчики оставляют за собой право изменять, балансировать или сбрасывать экономику для поддержания здоровья игры.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">5.</span> Пользовательский контент
              </h2>
              <p>Названия команд, логотипы и общение должны соответствовать стандартным правилам приличия. Оскорбительный или незаконный контент приведет к предупреждениям или банам.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">6.</span> Отказ от гарантий
              </h2>
              <p>Игра предоставляется "КАК ЕСТЬ". Мы не гарантируем бесперебойную работу, отсутствие ошибок или сохранение виртуальных активов в случае непредвиденных сбоев сервера или изменений API (включая отключения Google Fit API).</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-[#0B0F19] items-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-20%] w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neon-cyan/5 via-[#0B0F19]/80 to-[#0B0F19] pointer-events-none" />
      
      <div className="w-full max-w-2xl z-10 flex flex-col pt-10 pb-20">
        
        <Link 
          href="/onboarding" 
          className="text-neon-cyan hover:text-white font-orbitron text-sm mb-8 flex items-center gap-2 transition-colors w-fit"
        >
          ← Back
        </Link>

        <h1 className="text-3xl font-black text-white mb-8 tracking-wide font-orbitron drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
          Terms of Service
        </h1>

        <div className="bg-black/60 backdrop-blur-md border border-gray-800 p-6 md:p-8 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-8 text-gray-300 font-inter text-sm md:text-base leading-relaxed">
          
          <div className="text-center pb-4 border-b border-gray-800/50">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Effective Date: June 10, 2026</p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">1.</span> Acceptance of Terms
            </h2>
            <p>
              By accessing and playing FitManager (the "Game"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Game.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">2.</span> Physical Activity & Fitness Data (Google Fit)
            </h2>
            <p>
              FitManager utilizes physical activity data (such as Step Count) retrieved from Google Fit to reward players. By connecting your Google Fit account, you agree to allow us read-only access to this data strictly for the purposes of gameplay progression. We are not a medical app, and the data displayed or utilized in the Game should not be considered medical advice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">3.</span> Fair Play & Anti-Cheat
            </h2>
            <p>
              The use of third-party bots, step-spoofing emulators (e.g., artificially inflating Google Fit steps), auto-clickers, or any software designed to manipulate Sweat Points or match results is strictly prohibited. Violators will face permanent bans without compensation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">4.</span> Virtual Assets & Economy
            </h2>
            <p>
              In-game currencies (FanCoins, Stamina Points) and digital assets (players) have no guaranteed real-world value. The developers reserve the right to modify, balance, or reset the economy to maintain game health.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">5.</span> User Content
            </h2>
            <p>
              Team names, logos, and communication must comply with standard decency rules. Offensive, illegal, or heavily controversial content will result in warnings or bans.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">6.</span> Disclaimer of Warranties
            </h2>
            <p>
              The Game is provided "AS IS". We do not guarantee uninterrupted service, completely bug-free gameplay, or the preservation of virtual assets in the event of unforeseen server failures or API changes (including Google Fit API deprecations).
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
