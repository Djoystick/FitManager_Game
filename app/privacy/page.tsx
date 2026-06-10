'use client';

import Link from 'next/link';
import { useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';

export default function PrivacyPage() {
  const { language } = useContext(LanguageContext);

  if (language === 'ru') {
    return (
      <div className="flex flex-col flex-1 min-h-screen bg-[#0B0F19] items-center p-6 relative overflow-x-hidden overflow-y-auto">
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
            Политика Конфиденциальности
          </h1>
          <div className="bg-black/60 backdrop-blur-md border border-gray-800 p-6 md:p-8 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-8 text-gray-300 font-inter text-sm md:text-base leading-relaxed">
            <div className="text-center pb-4 border-b border-gray-800/50">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Дата вступления в силу: 10 июня 2026</p>
            </div>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">1.</span> Какую информацию мы собираем
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Данные Telegram:</strong> Мы получаем ваш Telegram ID, имя пользователя и язык через Telegram WebApp SDK.</li>
                <li><strong>Данные о фитнесе (Google Fit):</strong> При подключении Google Fit через OAuth мы собираем количество шагов для перевода их во внутриигровые Sweat Points.</li>
                <li><strong>Данные кошелька:</strong> При подключении кошелька TON мы сохраняем ваш публичный адрес для транзакций и наград.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">2.</span> Как мы используем ваши данные
              </h2>
              <p>Ваши данные о физической активности используются <strong>исключительно</strong> для расчета внутриигровых наград. Мы не продаем и не передаем ваши данные третьим лицам. Ваш Telegram ID используется для аутентификации.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">3.</span> Политика использования данных Google API
              </h2>
              <p>Использование FitManager информации, полученной от Google API, соответствует <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" className="text-cyan-400 hover:underline">Политике данных Google API</a>, включая требования Limited Use.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">4.</span> Хранение и удаление данных
              </h2>
              <p>Вы можете запросить полное удаление вашей франшизы и данных через внутриигровую кнопку "Уйти в отставку". Это действие необратимо.</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
                <span className="text-cyan-400">5.</span> Связаться с нами
              </h2>
              <p>По вопросам конфиденциальности обращайтесь в нашу поддержку в официальном канале Telegram.</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-[#0B0F19] items-center p-6 relative overflow-x-hidden overflow-y-auto">
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
          Privacy Policy
        </h1>

        <div className="bg-black/60 backdrop-blur-md border border-gray-800 p-6 md:p-8 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-8 text-gray-300 font-inter text-sm md:text-base leading-relaxed">
          
          <div className="text-center pb-4 border-b border-gray-800/50">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Effective Date: June 10, 2026</p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">1.</span> Information We Collect
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Telegram Data:</strong> We receive your Telegram ID, username, and language preference via the Telegram WebApp SDK to uniquely identify your franchise.</li>
              <li><strong>Fitness Data (Google Fit):</strong> If you choose to connect Google Fit via OAuth, we collect your step counts and active minutes to convert them into in-game Sweat Points.</li>
              <li><strong>Wallet Data:</strong> If you connect a TON wallet, we store your public address for marketplace transactions and season rewards.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">2.</span> How We Use Your Data
            </h2>
            <p>
              Your physical activity data is used <strong>exclusively</strong> for calculating in-game rewards. We do not sell, rent, or share your fitness data with third-party advertising platforms. Your Telegram ID is used to authenticate you without passwords.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">3.</span> Google API Services User Data Policy
            </h2>
            <p>
              FitManager's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" className="text-cyan-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">4.</span> Data Retention & Deletion
            </h2>
            <p>
              You can request full deletion of your franchise and associated data via the in-game "Resign as Manager" button. This action is irreversible and immediately wipes your Telegram link, fitness history, and squad from our active database.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">5.</span> Contact Us
            </h2>
            <p>
              For privacy-related inquiries, please contact our support team via our official Telegram channel or email <a href="mailto:privacy@fitmanager.web3" className="text-cyan-400 hover:underline">privacy@fitmanager.web3</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
