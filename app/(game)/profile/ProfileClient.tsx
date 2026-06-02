'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { renameTeamAction } from '@/app/actions/teamActions';
import { Edit3, FileText, AlertTriangle, Bell, Award, CheckCircle, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTransition } from 'react';

interface UserData {
  wallet_address: string | null;
}

export default function ProfileClient({ 
  isAdmin, 
  initialTeamName, 
  initialLogoUrl, 
  fcBalance
}: { 
  isAdmin?: boolean; 
  initialTeamName: string; 
  initialLogoUrl?: string | null; 
  fcBalance: number;
}) {
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
  
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl || '');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState('');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  const handleOpenAvatarModal = () => {
    setAvatarSeed(Math.random().toString(36).substring(7));
    setShowAvatarModal(true);
  };
  
  const previewUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;

  const handleSaveAvatar = () => {
    setIsSavingAvatar(true);
    startTransition(async () => {
      const { changeLogoAction } = await import('@/app/actions/teamActions');
      const res = await changeLogoAction(previewUrl);
      if (res.success) {
        setLogoUrl(previewUrl);
        setShowAvatarModal(false);
        toast.success('Avatar updated!');
        window.dispatchEvent(new Event('balanceUpdated'));
      } else {
        const errorMsg = res.error === 'error_insufficient_fc' 
          ? t.error_insufficient_fc || 'Not enough FC'
          : 'Error updating avatar';
        toast.error(errorMsg);
      }
      setIsSavingAvatar(false);
    });
  };

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
    <div className="h-full flex flex-col overflow-y-auto bg-[#060913] text-white relative custom-scrollbar">
      {/* ── Background grid ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
           style={{ backgroundImage: 'linear-gradient(rgba(0,240,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,240,255,0.06)_0%,transparent_100%)]" />

      <div className="flex flex-col flex-1 p-4 gap-4 relative z-10 max-w-md mx-auto w-full">
        
        {/* HEADER */}
        <header className="flex items-center justify-between mb-2">
          <h1 className={`text-xl font-black text-white tracking-widest uppercase ${fontClass}`}>
            {t.user_profile}
          </h1>
        </header>

        {/* ── TOP SECTION (Identity & Web3) ── */}
        <div className="grid grid-cols-[auto_1fr] gap-4 bg-gray-900/60 backdrop-blur-md p-4 rounded-2xl border border-neon-cyan/30 shadow-[0_0_20px_rgba(0,240,255,0.1)]">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-neon-cyan to-blue-600 flex items-center justify-center border-2 border-neon-cyan shadow-[0_0_15px_rgba(0,240,255,0.4)] flex-shrink-0">
            <span className="text-2xl font-black text-black font-orbitron">
              {tgUser?.first_name?.charAt(0) || '?'}
            </span>
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <span className={`text-base font-bold text-white truncate ${fontClass}`}>
              {tgUser?.first_name} {tgUser?.last_name}
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-500 text-[10px] font-mono uppercase">ID: {tgUser?.id || userId || '—'}</span>
            </div>
            
            <div className="mt-2 border-t border-gray-800 pt-2">
              {userData?.wallet_address ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse shadow-[0_0_8px_rgba(57,255,20,0.8)]"></div>
                  <span className="font-mono text-neon-green text-[10px] tracking-wider">{shortenAddress(userData.wallet_address)}</span>
                </div>
              ) : (
                <div className="scale-90 origin-left">
                  <WalletConnect />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── MIDDLE SECTION (Team Command) ── */}
        <section className="bg-gray-900/40 backdrop-blur-md p-4 rounded-2xl border border-gray-800 shadow-lg relative overflow-hidden flex flex-col gap-3">
          <h2 className={`text-[10px] uppercase tracking-widest text-gray-500 font-bold ${fontClass}`}>Team Command</h2>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl bg-black border border-neon-cyan/50 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                {logoUrl ? (
                  <img src={logoUrl} alt="Team Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold">🦊</span>
                )}
              </div>
              <button 
                onClick={handleOpenAvatarModal}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
              >
                <Edit3 size={12} className="text-gray-300" />
              </button>
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{t.team_ovr || 'Franchise'}</span>
              
              {isEditingName ? (
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    className="bg-black border border-neon-cyan text-white px-2 py-1.5 rounded text-sm font-orbitron w-full outline-none"
                    maxLength={20}
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <button onClick={handleSaveName} disabled={isPending} className="w-6 h-6 flex items-center justify-center bg-neon-cyan text-black rounded text-xs font-black">{isPending ? '..' : '✓'}</button>
                    <button onClick={() => setIsEditingName(false)} className="w-6 h-6 flex items-center justify-center bg-gray-800 text-gray-300 rounded text-xs">✕</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-black text-white font-orbitron truncate">{teamName}</span>
                  <button onClick={() => { setIsEditingName(true); setNewName(teamName); }} className="w-8 h-8 flex items-center justify-center bg-gray-800 border border-gray-700 rounded-lg shrink-0 relative group">
                    <Edit3 size={14} className="text-gray-400" />
                    <span className="absolute -top-6 text-[9px] text-yellow-500 font-bold opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">1000 FC</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── ACHIEVEMENTS SHOWCASE ── */}
        <section className="bg-gray-900/40 backdrop-blur-md p-4 rounded-2xl border border-gray-800 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-600 to-yellow-900 border border-yellow-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)]">
              <Award className="text-yellow-400" size={20} />
            </div>
            <div>
              <h2 className={`text-xs uppercase tracking-widest text-white font-bold ${fontClass}`}>
                Зал Славы
              </h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Твои достижения</p>
            </div>
          </div>
          <Link href="/achievements" className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-neon-cyan hover:border-neon-cyan/50 transition-colors">
            <ChevronRight size={16} />
          </Link>
        </section>

        {/* ── LOWER SECTION (System Config) ── */}
        <div className="grid grid-cols-2 gap-4">
          <section className="bg-gray-900/40 backdrop-blur-md p-4 rounded-2xl border border-gray-800 shadow-lg flex flex-col gap-3">
            <h2 className={`text-[10px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2 ${fontClass}`}>
               {t.language}
            </h2>
            <div className="flex bg-black rounded-lg border border-gray-800 p-1">
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${language === 'en' ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
              >EN</button>
              <button
                onClick={() => setLanguage('ru')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${language === 'ru' ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
              >RU</button>
            </div>
          </section>

          <section className="bg-gray-900/40 backdrop-blur-md p-4 rounded-2xl border border-gray-800 shadow-lg flex flex-col gap-3">
             <h2 className={`text-[10px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2 ${fontClass}`}>
               {t.notifications || 'Notifs'}
             </h2>
             <div className="flex-1 flex items-center justify-center">
               <button 
                onClick={() => setNotifications(!notifications)}
                className={`w-14 h-6 rounded-full p-1 transition-colors relative ${notifications ? 'bg-neon-green/80' : 'bg-gray-800 border border-gray-700'}`}
               >
                 <div className={`w-4 h-4 bg-black rounded-full transition-transform absolute top-1 ${notifications ? 'left-9' : 'left-1'}`} />
               </button>
             </div>
          </section>
        </div>

        {/* ADMIN LINK (Conditional) */}
        {isAdmin && (
          <Link href="/admin/logs" className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-red-900/20 border border-red-500/30 text-red-400 rounded-xl uppercase tracking-widest text-[10px] font-bold hover:bg-red-900/40 transition-all">
            ⚙️ Developer Console
          </Link>
        )}

        {/* ── FOOTER ── */}
        <div className="mt-auto pt-6 flex flex-col gap-4">
          <div className="flex justify-center gap-6">
            <button onClick={() => setShowTerms(true)} className="text-[10px] text-gray-600 hover:text-neon-cyan transition-colors uppercase tracking-widest flex items-center gap-1">
              <FileText size={10} /> {t.terms_of_use || 'Terms'}
            </button>
            <button onClick={() => setShowDisclaimer(true)} className="text-[10px] text-gray-600 hover:text-neon-cyan transition-colors uppercase tracking-widest flex items-center gap-1">
              <AlertTriangle size={10} /> {t.disclaimer || 'Disclaimer'}
            </button>
          </div>
        </div>

      </div>

      {/* Bottom tab bar spacer */}
      <div className="h-16 flex-shrink-0" />

      {/* MODALS */}
      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowTerms(false)}>
          <div className="w-full max-w-sm bg-gray-900 border border-neon-cyan/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,240,255,0.15)] relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-neon-cyan/10 rounded-full blur-xl -mr-10 -mt-10"></div>
            <h3 className={`text-white font-bold mb-4 uppercase tracking-widest text-sm ${fontClass}`}>{t.terms_of_use || 'Terms'}</h3>
            <div className="text-[10px] text-gray-400 space-y-3 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar relative z-10 uppercase tracking-wide">
              <p>Внутриигровая валюта (FanCoins, SP) не имеет реальной финансовой ценности и не подлежит обмену на фиатные деньги вне нашего TON-маркета.</p>
              <p>Разработчики оставляют за собой право заблокировать аккаунт при выявлении мошенничества, накрутки шагов или использовании запрещенных слов.</p>
            </div>
            <button onClick={() => setShowTerms(false)} className="w-full py-2 bg-neon-cyan text-black font-bold uppercase tracking-widest text-xs rounded-lg shadow-[0_0_15px_rgba(0,240,255,0.4)]">Закрыть</button>
          </div>
        </div>
      )}

      {showDisclaimer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowDisclaimer(false)}>
          <div className="w-full max-w-sm bg-gray-900 border border-neon-cyan/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,240,255,0.15)] relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-neon-cyan/10 rounded-full blur-xl -mr-10 -mt-10"></div>
            <h3 className={`text-white font-bold mb-4 uppercase tracking-widest text-sm ${fontClass}`}>{t.disclaimer || 'Disclaimer'}</h3>
            <div className="text-[10px] text-gray-400 space-y-3 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar relative z-10 uppercase tracking-wide">
              <p><strong className="text-neon-cyan">Медицинский отказ:</strong> Приложение носит исключительно развлекательный характер и не является медицинским устройством. Перед занятиями спортом проконсультируйтесь с врачом.</p>
              <p><strong className="text-neon-cyan">Крипто-отказ (Web3):</strong> Мы не являемся биржей или брокером. Покупка игроков за TON — это внутриигровая транзакция. Курс криптовалют волатилен, ответственность за финансовые операции лежит на пользователе.</p>
            </div>
            <button onClick={() => setShowDisclaimer(false)} className="w-full py-2 bg-neon-cyan text-black font-bold uppercase tracking-widest text-xs rounded-lg shadow-[0_0_15px_rgba(0,240,255,0.4)]">Закрыть</button>
          </div>
        </div>
      )}

      {/* removed selected achievement modal */}

      {showAvatarModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowAvatarModal(false)}>
          <div className="w-full max-w-sm bg-gray-900 border border-neon-cyan/30 rounded-2xl p-6 flex flex-col items-center gap-4 relative overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.15)]" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-32 h-32 bg-neon-cyan/10 rounded-full blur-2xl -ml-10 -mt-10 pointer-events-none"></div>
            <h3 className={`text-white font-bold text-sm uppercase tracking-widest ${fontClass} relative z-10`}>Avatar Generator</h3>
            
            <div className="w-24 h-24 rounded-2xl border border-neon-cyan/50 overflow-hidden bg-black shadow-[0_0_20px_rgba(0,240,255,0.3)] relative z-10">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>

            <div className="w-full relative z-10">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Seed (type anything)</label>
              <input 
                type="text" 
                value={avatarSeed}
                onChange={e => setAvatarSeed(e.target.value)}
                className="w-full bg-black border border-neon-cyan/50 text-white px-3 py-2 rounded-lg text-xs font-orbitron focus:border-neon-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] outline-none transition-all"
              />
            </div>

            <div className="flex gap-2 w-full mt-2 relative z-10">
              <button 
                onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
                className="flex-1 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-[10px] uppercase font-bold tracking-widest rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
              >
                Randomize
              </button>
              <button 
                onClick={handleSaveAvatar}
                disabled={isSavingAvatar}
                className="flex-1 py-2 bg-yellow-500 text-black text-[10px] uppercase font-black tracking-widest rounded-lg hover:bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)] disabled:opacity-50 transition-all"
              >
                {isSavingAvatar ? '...' : 'Save (500 FC)'}
              </button>
            </div>
            
            <button onClick={() => setShowAvatarModal(false)} className="mt-2 text-gray-500 text-[10px] uppercase tracking-widest hover:text-white relative z-10">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
