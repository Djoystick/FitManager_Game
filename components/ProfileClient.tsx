'use client';

import { useState, useTransition, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dict } from '@/lib/dictionaries';
import { LanguageContext } from '@/components/LanguageContext';
import { renameTeamAction } from '@/app/actions/teamActions';
import { ChevronLeft, Edit3, Image as ImageIcon, Bell, Globe, FileText, AlertTriangle, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  initialTeamName: string;
  fcBalance: number;
  language: string;
}

const AVATARS = [
  'cyber_punk_1', 'neon_skull', 'robotic_lion', 'pixel_ghost'
];

export function ProfileClient({ initialTeamName, fcBalance, language }: Props) {
  const router = useRouter();
  const { setLanguage } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];

  const [teamName, setTeamName] = useState(initialTeamName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isPending, startTransition] = useTransition();

  const [notifications, setNotifications] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleSaveName = () => {
    if (!newName.trim() || newName === teamName) {
      setIsEditingName(false);
      return;
    }
    
    startTransition(async () => {
      const res = await renameTeamAction(newName);
      if (res.success) {
        setTeamName(newName);
        setIsEditingName(false);
        toast.success(t.rename_success || 'Success');
        
        // Dispatch event to update balance in GlobalHeader
        window.dispatchEvent(new Event('balanceUpdated'));
      } else {
        const errorMsg = res.error === 'error_censorship' 
          ? t.error_censorship 
          : res.error === 'error_insufficient_fc' 
            ? t.error_insufficient_fc 
            : t.rename_error;
        toast.error(errorMsg || 'Error');
      }
    });
  };

  const handleToggleLang = () => {
    const nextLang = language === 'ru' ? 'en' : 'ru';
    document.cookie = `language=${nextLang}; path=/; max-age=31536000`;
    setLanguage(nextLang);
    router.refresh();
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800 p-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-gray-900 rounded-full border border-gray-700">
          <ChevronLeft className="text-gray-300" />
        </button>
        <h1 className="text-sm font-bold uppercase tracking-widest text-white">{t.profile_settings || 'PROFILE'}</h1>
        <div className="w-10 h-10" />
      </header>

      <div className="p-4 flex flex-col gap-6">
        
        {/* TEAM SETTINGS */}
        <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="text-[10px] text-neon-cyan uppercase tracking-widest font-bold">Team</h2>
          
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs text-gray-500 mb-1">{t.team_ovr || 'Name'}</span>
              {isEditingName ? (
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="bg-black border border-neon-cyan text-white px-2 py-1 rounded w-48 font-orbitron"
                  maxLength={20}
                  autoFocus
                />
              ) : (
                <span className="text-lg font-black text-white font-orbitron">{teamName}</span>
              )}
            </div>
            
            {isEditingName ? (
              <div className="flex gap-2">
                <button onClick={() => setIsEditingName(false)} className="px-3 py-1 bg-gray-800 text-gray-300 rounded font-bold text-xs">✕</button>
                <button onClick={handleSaveName} disabled={isPending} className="px-3 py-1 bg-neon-cyan text-black rounded font-bold text-xs">{isPending ? '...' : '✓'}</button>
              </div>
            ) : (
              <button onClick={() => { setIsEditingName(true); setNewName(teamName); }} className="p-2 bg-gray-800 rounded-full flex flex-col items-center group relative">
                <Edit3 className="w-4 h-4 text-gray-400" />
                <span className="absolute -bottom-5 text-[8px] whitespace-nowrap text-yellow-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">1000 FC</span>
              </button>
            )}
          </div>
          
          <div className="border-t border-gray-800 my-1"></div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-neon-cyan flex items-center justify-center overflow-hidden">
                <span className="text-lg font-bold">🦊</span>
              </div>
              <span className="text-sm font-bold text-gray-300">{t.choose_avatar || 'Avatar'}</span>
            </div>
            <button 
              onClick={() => toast.success(t.avatar_success || 'Avatar Updated')}
              className="px-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 hover:text-white"
            >
              {t.choose_avatar || 'Change'}
            </button>
          </div>
        </section>

        {/* APP SETTINGS */}
        <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex flex-col gap-4">
          <h2 className="text-[10px] text-purple-400 uppercase tracking-widest font-bold">App</h2>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-bold text-gray-300">Language</span>
            </div>
            <button 
              onClick={handleToggleLang}
              className="w-16 h-8 bg-gray-800 rounded-full p-1 relative transition-colors flex items-center border border-gray-700"
            >
              <div className={`w-6 h-6 bg-neon-cyan rounded-full flex items-center justify-center text-[10px] font-black transition-transform ${language === 'ru' ? 'translate-x-8' : 'translate-x-0'}`}>
                {language.toUpperCase()}
              </div>
            </button>
          </div>

          <div className="border-t border-gray-800 my-1"></div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-bold text-gray-300">{t.notifications || 'Notifications'}</span>
            </div>
            <button 
              onClick={() => setNotifications(!notifications)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${notifications ? 'bg-neon-green' : 'bg-gray-700'}`}
            >
              <div className={`w-4 h-4 bg-black rounded-full transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </section>

        {/* LEGAL */}
        <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex flex-col gap-2">
          <h2 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Legal & Docs</h2>
          
          <button onClick={() => setShowTerms(true)} className="flex items-center gap-3 w-full p-2 hover:bg-gray-800 rounded-lg text-left transition-colors">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">{t.terms_of_use || 'Terms'}</span>
          </button>
          
          <button onClick={() => setShowDisclaimer(true)} className="flex items-center gap-3 w-full p-2 hover:bg-gray-800 rounded-lg text-left transition-colors">
            <AlertTriangle className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">{t.disclaimer || 'Disclaimer'}</span>
          </button>
        </section>

      </div>

      {/* MODALS */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowTerms(false)}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-4">{t.terms_of_use}</h3>
            <div className="text-sm text-gray-400 space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              <p>Внутриигровая валюта (FanCoins, SP) не имеет реальной финансовой ценности и не подлежит обмену на фиатные деньги вне нашего TON-маркета.</p>
              <p>Разработчики оставляют за собой право заблокировать аккаунт при выявлении мошенничества, накрутки шагов или использовании запрещенных слов.</p>
            </div>
            <button onClick={() => setShowTerms(false)} className="w-full py-2 bg-neon-cyan text-black font-bold rounded-lg">Закрыть</button>
          </div>
        </div>
      )}

      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowDisclaimer(false)}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-4">{t.disclaimer}</h3>
            <div className="text-sm text-gray-400 space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              <p><strong className="text-white">Медицинский отказ:</strong> Приложение носит исключительно развлекательный характер и не является медицинским устройством. Перед занятиями спортом проконсультируйтесь с врачом.</p>
              <p><strong className="text-white">Крипто-отказ (Web3):</strong> Мы не являемся биржей или брокером. Покупка игроков за TON — это внутриигровая транзакция. Курс криптовалют волатилен, ответственность за финансовые операции лежит на пользователе.</p>
            </div>
            <button onClick={() => setShowDisclaimer(false)} className="w-full py-2 bg-neon-cyan text-black font-bold rounded-lg">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}
