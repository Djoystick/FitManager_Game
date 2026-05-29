'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { renameTeamAction } from '@/app/actions/teamActions';
import { Edit3, FileText, AlertTriangle, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTransition } from 'react';

interface UserData {
  wallet_address: string | null;
}

export default function ProfileClient({ isAdmin, initialTeamName, fcBalance }: { isAdmin?: boolean, initialTeamName: string, fcBalance: number }) {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const { language, setLanguage } = useContext(LanguageContext);
  const t = dict[language];
  const fontClass = language === 'ru' ? 'font-russo' : 'font-orbitron';

  const [userData, setUserData] = useState<UserData | null>(null);
  const [tgUser, setTgUser] = useState<any>(null);

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@twa-dev/sdk').then((module) => {
        const WebApp = module.default;
        if (WebApp.initDataUnsafe?.user) {
          setTgUser(WebApp.initDataUnsafe.user);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && userId) {
      const fetchUserData = async () => {
        try {
          const res = await fetch(`/api/user/me?userId=${userId}`);
          if (res.ok) {
            const json = await res.json();
            setUserData(json.user);
          }
        } catch (error) {
          console.error("Failed to fetch user data", error);
        }
      };
      fetchUserData();
    }
  }, [isAuthenticated, userId]);

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex flex-col flex-1 p-6 gap-6 overflow-y-auto">
      {/* HEADER */}
      <header className="flex items-center gap-4">
        <Link href="/" className="w-10 h-10 flex items-center justify-center bg-gray-900 border border-gray-700 rounded-lg hover:border-neon-cyan transition-colors">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className={`text-2xl font-bold text-white tracking-tight ${fontClass}`}>
          {t.user_profile}
        </h1>
      </header>

      {/* USER INFO CARD */}
      <section className="bg-black/60 backdrop-blur-md p-6 rounded-xl border border-neon-cyan/40 shadow-[0_0_15px_rgba(0,240,255,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-neon-cyan/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-cyan to-blue-600 flex items-center justify-center border-2 border-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)] flex-shrink-0">
            <span className="text-2xl font-black text-black font-orbitron">
              {tgUser?.first_name?.charAt(0) || '?'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={`text-lg font-bold text-white ${fontClass}`}>
              {tgUser?.first_name} {tgUser?.last_name}
            </span>
            {tgUser?.username && (
              <span className="text-neon-cyan text-sm">@{tgUser.username}</span>
            )}
            <span className="text-gray-500 text-xs mt-1 font-mono">
              {t.id}: {tgUser?.id || userId || 'Unknown'}
            </span>
          </div>
        </div>
      </section>

      {/* TEAM SETTINGS */}
      <section className="bg-black/60 backdrop-blur-md p-5 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden flex flex-col gap-4">
        <h2 className={`text-sm uppercase tracking-widest text-gray-400 font-semibold ${fontClass}`}>Team Settings</h2>
        
        <div className="flex items-center justify-between">
          <div>
            <span className="block text-xs text-gray-500 mb-1">{t.team_ovr || 'Name'}</span>
            {isEditingName ? (
              <input 
                type="text" 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                className="bg-black border border-neon-cyan text-white px-2 py-1 rounded w-32 md:w-48 font-orbitron"
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
            <button onClick={() => { setIsEditingName(true); setNewName(teamName); }} className="p-2 bg-gray-800 rounded-full flex flex-col items-center group relative border border-gray-700">
              <Edit3 className="w-4 h-4 text-gray-400" />
              <span className="absolute -bottom-5 text-[8px] whitespace-nowrap text-yellow-500 font-bold">1000 FC</span>
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

      {/* WEB3 STATUS CARD */}
      <section className="bg-black/60 backdrop-blur-md p-5 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden flex flex-col gap-3">
        <h2 className={`text-sm uppercase tracking-widest text-gray-400 font-semibold ${fontClass}`}>{t.wallet}</h2>
        {userData?.wallet_address ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-900/20 border border-neon-green/30">
            <div className="w-3 h-3 rounded-full bg-neon-green animate-pulse shadow-[0_0_8px_rgba(57,255,20,0.8)]"></div>
            <span className="font-mono text-neon-green tracking-wider">{shortenAddress(userData.wallet_address)}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3 rounded-lg bg-red-900/20 border border-neon-pink/30">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-neon-pink shadow-[0_0_8px_rgba(255,0,60,0.8)]"></div>
              <span className={`text-neon-pink text-sm ${fontClass}`}>{t.not_connected}</span>
            </div>
            <WalletConnect />
          </div>
        )}
      </section>

      {/* SETTINGS / LANGUAGE TOGGLE */}
      <section className="bg-black/60 backdrop-blur-md p-5 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden flex flex-col gap-4">
        <h2 className={`text-sm uppercase tracking-widest text-gray-400 font-semibold ${fontClass}`}>{t.language}</h2>
        <div className="flex gap-2 p-1 bg-gray-900 rounded-lg border border-gray-700">
          <button
            onClick={() => setLanguage('en')}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
              language === 'en' 
                ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,240,255,0.5)]' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.english}
          </button>
          <button
            onClick={() => setLanguage('ru')}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
              language === 'ru' 
                ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,240,255,0.5)]' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.russian}
          </button>
        </div>

        <div className="border-t border-gray-800 my-1"></div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-400" />
            <span className={`text-sm font-bold text-gray-300 ${fontClass}`}>{t.notifications || 'Notifications'}</span>
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
      <section className="bg-black/60 backdrop-blur-md p-5 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden flex flex-col gap-2">
        <h2 className={`text-sm uppercase tracking-widest text-gray-400 font-semibold mb-2 ${fontClass}`}>Legal & Docs</h2>
        
        <button onClick={() => setShowTerms(true)} className="flex items-center gap-3 w-full p-2 hover:bg-gray-800 rounded-lg text-left transition-colors">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className={`text-sm text-gray-300 ${fontClass}`}>{t.terms_of_use || 'Terms'}</span>
        </button>
        
        <button onClick={() => setShowDisclaimer(true)} className="flex items-center gap-3 w-full p-2 hover:bg-gray-800 rounded-lg text-left transition-colors">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          <span className={`text-sm text-gray-300 ${fontClass}`}>{t.disclaimer || 'Disclaimer'}</span>
        </button>
      </section>
      {/* ADMIN LINK (Conditional) */}
      {isAdmin && (
        <section className="mt-2">
          <Link href="/admin" className="flex items-center justify-center gap-2 w-full py-3 bg-red-900/10 border border-red-500/50 text-red-500 rounded-lg uppercase tracking-widest text-sm font-bold hover:bg-red-900/30 hover:border-red-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            ⚙️ Developer Console
          </Link>
        </section>
      )}

      <Link href="/" className={`mt-auto w-full py-3 bg-gray-900 border border-gray-700 text-gray-300 text-center rounded-lg uppercase tracking-wider hover:border-white hover:text-white transition-colors ${fontClass}`}>
        {t.back_to_dashboard}
      </Link>

      {/* MODALS */}
      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowTerms(false)}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-4">{t.terms_of_use || 'Terms'}</h3>
            <div className="text-sm text-gray-400 space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              <p>Внутриигровая валюта (FanCoins, SP) не имеет реальной финансовой ценности и не подлежит обмену на фиатные деньги вне нашего TON-маркета.</p>
              <p>Разработчики оставляют за собой право заблокировать аккаунт при выявлении мошенничества, накрутки шагов или использовании запрещенных слов.</p>
            </div>
            <button onClick={() => setShowTerms(false)} className="w-full py-2 bg-neon-cyan text-black font-bold rounded-lg">Закрыть</button>
          </div>
        </div>
      )}

      {showDisclaimer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowDisclaimer(false)}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-4">{t.disclaimer || 'Disclaimer'}</h3>
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
