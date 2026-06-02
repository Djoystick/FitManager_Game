'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { renameTeamAction } from '@/app/actions/teamActions';
import { Edit3, FileText, AlertTriangle, Award, ChevronRight, Globe, Bell, Shield, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTransition } from 'react';
import { motion } from 'framer-motion';

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

  const [userData,      setUserData]      = useState<UserData | null>(null);
  const [tgUser,        setTgUser]        = useState<any>(null);
  const [teamName,      setTeamName]      = useState(initialTeamName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName,       setNewName]       = useState('');
  const [isPending,     startTransition]  = useTransition();
  const [notifications, setNotifications] = useState(true);
  const [showTerms,     setShowTerms]     = useState(false);
  const [showDisclaimer,setShowDisclaimer]= useState(false);
  const [logoUrl,       setLogoUrl]       = useState(initialLogoUrl || '');
  const [showAvatarModal,setShowAvatarModal] = useState(false);
  const [avatarSeed,    setAvatarSeed]    = useState('');
  const [isSavingAvatar,setIsSavingAvatar]= useState(false);

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
    if (!newName.trim() || newName === teamName) { setIsEditingName(false); return; }
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
        if (WebApp.initDataUnsafe?.user) setTgUser(WebApp.initDataUnsafe.user);
      });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && userId) {
      const fetchUserData = async () => {
        try {
          const res = await fetch(`/api/user/me?userId=${userId}`);
          if (res.ok) { const json = await res.json(); setUserData(json.user); }
        } catch (error) { console.error("Failed to fetch user data", error); }
      };
      fetchUserData();
    }
  }, [isAuthenticated, userId]);

  const shortenAddress = (address: string) =>
    `${address.slice(0, 4)}...${address.slice(-4)}`;

  return (
    <div className="h-full flex flex-col overflow-y-auto text-white relative custom-scrollbar"
         style={{ background: '#05060f' }}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none bg-grid-cyan" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(147,51,234,0.1)_0%,transparent_100%)]" />

      <div className="flex flex-col flex-1 p-3 gap-3 relative z-10">

        {/* ── HERO: Manager Identity Card ─────────────────────────────── */}
        <motion.div
          className="glass-card-violet relative overflow-hidden p-4"
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="flex-shrink-0 relative group">
              <div
                className="w-16 h-16 hex-clip flex items-center justify-center overflow-hidden violet-glow-pulse"
                style={{ background: 'linear-gradient(135deg, rgba(147,51,234,0.4), rgba(0,240,255,0.2))' }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Team" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black font-orbitron text-white">
                    {tgUser?.first_name?.charAt(0) || '?'}
                  </span>
                )}
              </div>
              <button
                onClick={handleOpenAvatarModal}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#05060f] border border-violet-500/50
                           flex items-center justify-center hover:bg-violet-500/20 transition-colors"
              >
                <Edit3 size={10} className="text-violet-400" />
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-violet-400/70 uppercase tracking-widest font-bold mb-0.5">Manager</div>
              <div className="text-base font-black text-white font-orbitron truncate">
                {tgUser?.first_name} {tgUser?.last_name}
              </div>
              <div className="text-[9px] text-gray-500 font-mono mt-0.5">
                ID: {tgUser?.id || userId || '—'}
              </div>

              {/* Wallet row */}
              <div className="mt-2">
                {userData?.wallet_address ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                    <span className="font-mono text-emerald-300 text-[10px] tracking-wider">
                      {shortenAddress(userData.wallet_address)}
                    </span>
                  </div>
                ) : (
                  <div className="scale-90 origin-left">
                    <WalletConnect />
                  </div>
                )}
              </div>
            </div>

            {/* FC balance */}
            <div className="flex-shrink-0 flex flex-col items-end">
              <div className="text-[8px] text-gray-500 uppercase tracking-widest mb-0.5">Balance</div>
              <div className="text-lg font-black font-orbitron text-yellow-400">{fcBalance.toLocaleString()}</div>
              <div className="text-[8px] text-yellow-500/70 font-bold">FC</div>
            </div>
          </div>
        </motion.div>

        {/* ── TEAM COMMAND ─────────────────────────────────────────────── */}
        <motion.div
          className="glass-card relative overflow-hidden p-4"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-3">Team Command</div>
          <div className="flex items-center gap-4">
            {/* Team logo */}
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-xl overflow-hidden border border-cyan-500/30 bg-black/50
                              shadow-[0_0_15px_rgba(0,240,255,0.15)] flex items-center justify-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="Team Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold">⚽</span>
                )}
              </div>
            </div>

            {/* Team name */}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Franchise</div>
              {isEditingName ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="bg-black/50 border border-violet-500/60 text-white px-2 py-1.5 rounded-lg
                               text-sm font-orbitron w-full outline-none focus:border-violet-400"
                    maxLength={20}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button onClick={handleSaveName} disabled={isPending}
                      className="w-7 h-7 flex items-center justify-center bg-violet-500 text-white rounded-lg text-xs font-black">
                      {isPending ? '…' : '✓'}
                    </button>
                    <button onClick={() => setIsEditingName(false)}
                      className="w-7 h-7 flex items-center justify-center bg-white/10 text-gray-300 rounded-lg text-xs">
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-white font-orbitron truncate">{teamName}</span>
                  <button
                    onClick={() => { setIsEditingName(true); setNewName(teamName); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10
                               hover:border-violet-500/40 hover:bg-violet-500/10 transition-all group relative"
                  >
                    <Edit3 size={12} className="text-gray-500 group-hover:text-violet-400" />
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[8px] text-yellow-500 font-bold
                                     opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity bg-black/80 px-1.5 py-0.5 rounded">
                      1000 FC
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── ACHIEVEMENTS SHOWCASE ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Link
            href="/achievements"
            className="glass-card flex items-center justify-between p-4 hover:border-yellow-500/30 transition-all duration-200 group block"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                              bg-gradient-to-br from-yellow-600/30 to-yellow-900/20
                              border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                <Award className="text-yellow-400" size={18} />
              </div>
              <div>
                <div className="text-sm font-black text-white uppercase tracking-wider">Зал Славы</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-widest">Твои достижения</div>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-600 group-hover:text-yellow-400 transition-colors" />
          </Link>
        </motion.div>

        {/* ── SETTINGS GRID ────────────────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-2 gap-2"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}
        >
          {/* Language */}
          <div className="glass-card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-widest font-bold">
              <Globe size={10} className="text-violet-400" />
              {t.language}
            </div>
            <div className="flex bg-black/40 rounded-lg border border-white/5 p-0.5">
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                  language === 'en'
                    ? 'bg-violet-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >EN</button>
              <button
                onClick={() => setLanguage('ru')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                  language === 'ru'
                    ? 'bg-violet-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >RU</button>
            </div>
          </div>

          {/* Notifications */}
          <div className="glass-card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-widest font-bold">
              <Bell size={10} className="text-cyan-400" />
              {t.notifications || 'Notifs'}
            </div>
            <div className="flex-1 flex items-center justify-center">
              <button
                onClick={() => setNotifications(!notifications)}
                className={`w-14 h-6 rounded-full p-0.5 transition-all relative ${
                  notifications
                    ? 'bg-violet-500 shadow-[0_0_10px_rgba(147,51,234,0.5)]'
                    : 'bg-white/10 border border-white/10'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                  notifications ? 'translate-x-8' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── ADMIN LINK ───────────────────────────────────────────────── */}
        {isAdmin && (
          <Link href="/admin/logs"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                       bg-red-900/15 border border-red-500/25 text-red-400
                       uppercase tracking-widest text-[10px] font-bold hover:bg-red-900/30 transition-all">
            <Shield size={12} /> Developer Console
          </Link>
        )}

        {/* ── SCROLLABLE FOOTER (legal) ─────────────────────────────── */}
        <div className="mt-2 pt-2 border-t border-white/5 flex justify-center gap-6 pb-20">
          <button
            onClick={() => setShowTerms(true)}
            className="text-[9px] text-gray-700 hover:text-violet-400 transition-colors uppercase tracking-widest flex items-center gap-1"
          >
            <FileText size={9} /> {t.terms_of_use || 'Terms'}
          </button>
          <button
            onClick={() => setShowDisclaimer(true)}
            className="text-[9px] text-gray-700 hover:text-cyan-400 transition-colors uppercase tracking-widest flex items-center gap-1"
          >
            <AlertTriangle size={9} /> {t.disclaimer || 'Disclaimer'}
          </button>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────── */}
      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-md"
             onClick={() => setShowTerms(false)}>
          <div className="w-full max-w-[480px] glass-card rounded-b-none p-6 relative overflow-hidden"
               onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
            <button onClick={() => setShowTerms(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white">
              <X size={14} />
            </button>
            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm font-orbitron">
              {t.terms_of_use || 'Terms'}
            </h3>
            <div className="text-[10px] text-gray-400 space-y-3 mb-6 max-h-52 overflow-y-auto pr-2 custom-scrollbar uppercase tracking-wide">
              <p>Внутриигровая валюта (FanCoins, SP) не имеет реальной финансовой ценности и не подлежит обмену на фиатные деньги вне нашего TON-маркета.</p>
              <p>Разработчики оставляют за собой право заблокировать аккаунт при выявлении мошенничества, накрутки шагов или использовании запрещенных слов.</p>
            </div>
            <button onClick={() => setShowTerms(false)}
              className="w-full py-2.5 bg-violet-500 text-white font-bold uppercase tracking-widest text-xs rounded-xl
                         shadow-[0_0_15px_rgba(147,51,234,0.5)] hover:bg-violet-400 transition-colors">
              Закрыть
            </button>
          </div>
        </div>
      )}

      {showDisclaimer && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-md"
             onClick={() => setShowDisclaimer(false)}>
          <div className="w-full max-w-[480px] glass-card rounded-b-none p-6 relative overflow-hidden"
               onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
            <button onClick={() => setShowDisclaimer(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white">
              <X size={14} />
            </button>
            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm font-orbitron">
              {t.disclaimer || 'Disclaimer'}
            </h3>
            <div className="text-[10px] text-gray-400 space-y-3 mb-6 max-h-52 overflow-y-auto pr-2 custom-scrollbar uppercase tracking-wide">
              <p><strong className="text-violet-300">Медицинский отказ:</strong> Приложение носит исключительно развлекательный характер и не является медицинским устройством.</p>
              <p><strong className="text-cyan-300">Крипто-отказ (Web3):</strong> Мы не являемся биржей или брокером. Покупка игроков за TON — это внутриигровая транзакция.</p>
            </div>
            <button onClick={() => setShowDisclaimer(false)}
              className="w-full py-2.5 bg-cyan-500 text-black font-bold uppercase tracking-widest text-xs rounded-xl
                         shadow-[0_0_15px_rgba(0,240,255,0.5)] hover:bg-cyan-400 transition-colors">
              Закрыть
            </button>
          </div>
        </div>
      )}

      {showAvatarModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-md"
             onClick={() => setShowAvatarModal(false)}>
          <div className="w-full max-w-[480px] glass-card-violet rounded-b-none p-6 flex flex-col items-center gap-4 relative overflow-hidden"
               onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
            <h3 className="text-white font-bold text-sm uppercase tracking-widest font-orbitron relative z-10">Avatar Generator</h3>

            <div className="w-20 h-20 hex-clip overflow-hidden shadow-[0_0_20px_rgba(147,51,234,0.4)] relative z-10"
                 style={{ background: 'linear-gradient(135deg,rgba(147,51,234,0.3),rgba(0,240,255,0.2))' }}>
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>

            <div className="w-full relative z-10">
              <label className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 block">Seed (type anything)</label>
              <input
                type="text"
                value={avatarSeed}
                onChange={e => setAvatarSeed(e.target.value)}
                className="w-full bg-black/50 border border-violet-500/50 text-white px-3 py-2 rounded-lg
                           text-xs font-orbitron focus:border-violet-400 outline-none transition-all"
              />
            </div>

            <div className="flex gap-2 w-full relative z-10">
              <button
                onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
                className="flex-1 py-2 bg-white/5 border border-white/10 text-gray-300 text-[10px]
                           uppercase font-bold tracking-widest rounded-xl hover:bg-white/10 transition-colors"
              >
                Randomize
              </button>
              <button
                onClick={handleSaveAvatar}
                disabled={isSavingAvatar}
                className="flex-1 py-2 bg-yellow-500 text-black text-[10px] uppercase font-black tracking-widest
                           rounded-xl hover:bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)] disabled:opacity-50 transition-all"
              >
                {isSavingAvatar ? '...' : 'Save (500 FC)'}
              </button>
            </div>
            <button onClick={() => setShowAvatarModal(false)}
              className="text-gray-600 text-[9px] uppercase tracking-widest hover:text-white relative z-10 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
