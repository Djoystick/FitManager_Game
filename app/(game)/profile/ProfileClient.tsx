'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { LanguageContext } from '@/components/LanguageContext';
import { SubNavTabs } from '@/components/ui/SubNavTabs';
import { WalletConnect } from '@/components/WalletConnect';
import Link from 'next/link';
import { dict } from '@/lib/dictionaries';
import { renameTeamAction } from '@/app/actions/teamActions';
import { getManagerObjectivesAction, type ManagerObjective } from '@/app/actions/objectivesActions';
import {
  Edit3, FileText, AlertTriangle, Award, ChevronRight,
  Globe, Bell, Shield, X, Target, TrendingUp, UserMinus, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTransition } from 'react';
import { motion } from 'framer-motion';
import { usePageTour } from '@/components/providers/PageTourProvider';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// ProfileClient — MANAGER page with SubNav: GENERAL | AWARDS | RESULTS
// ─────────────────────────────────────────────────────────────────────────────

type ManagerTab = 'general' | 'awards' | 'results';

interface UserData { wallet_address: string | null; }

const PRIORITY_BADGE: Record<ManagerObjective['priority'], string> = {
  high:   'bg-red-500/20 text-red-400 border-red-500/40',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  low:    'bg-gray-500/10 text-gray-500 border-gray-600/30',
};

const STATUS_BADGE: Record<ManagerObjective['status'], string> = {
  active:   'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
  achieved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  failed:   'bg-red-500/15 text-red-400 border-red-500/40',
};

function ApprovalRingMeter({ value }: { value: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 70 ? '#34d399' : value >= 45 ? '#fbbf24' : '#f87171';

  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="flex-shrink-0">
      <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
      <circle
        cx="45" cy="45" r={r}
        fill="none" stroke={color}
        strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
      <text x="45" y="42" textAnchor="middle" fill="white" fontSize="16" fontWeight="900" fontFamily="var(--font-orbitron), monospace">{value}</text>
      <text x="45" y="54" textAnchor="middle" fill="rgb(107,114,128)" fontSize="6" fontWeight="700" fontFamily="sans-serif" textLength="32">APPROVAL</text>
    </svg>
  );
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
  const { language, setLanguage }   = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const { startTour, hasSeenTour, areAllToursSkipped } = usePageTour();
  const router = useRouter();

  const [activeTab,      setActiveTab]      = useState<ManagerTab>('general');
  const [userData,       setUserData]       = useState<UserData | null>(null);
  const [tgUser,         setTgUser]         = useState<any>(null);
  const [teamName,       setTeamName]       = useState(initialTeamName);
  const [isEditingName,  setIsEditingName]  = useState(false);
  const [newName,        setNewName]        = useState('');
  const [isPending,      startTransition]   = useTransition();
  const [notifications,  setNotifications]  = useState(true);
  const [showTerms,      setShowTerms]      = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [logoUrl,        setLogoUrl]        = useState(initialLogoUrl || '');
  const [showAvatarModal,setShowAvatarModal]= useState(false);
  const [avatarSeed,     setAvatarSeed]     = useState('');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [objectives,     setObjectives]     = useState<ManagerObjective[]>([]);
  const [approvalRating, setApprovalRating] = useState(65);
  const [managerLevel,   setManagerLevel]   = useState(1);

  const previewUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;

  // Load objectives
  useEffect(() => {
    if (isAuthenticated && userId) {
      getManagerObjectivesAction().then(res => {
        if (res.success && res.data) {
          setObjectives(res.data);
          setApprovalRating(res.approvalRating ?? 65);
        }
      });
    }
  }, [isAuthenticated, userId]);

  const handleOpenAvatarModal = () => { setAvatarSeed(Math.random().toString(36).substring(7)); setShowAvatarModal(true); };

  const handleSaveAvatar = () => {
    setIsSavingAvatar(true);
    startTransition(async () => {
      const { changeLogoAction } = await import('@/app/actions/teamActions');
      const res = await changeLogoAction(previewUrl);
      if (res.success) {
        setLogoUrl(previewUrl); setShowAvatarModal(false);
        toast.success(t.avatar_success || 'Avatar updated!');
        window.dispatchEvent(new Event('balanceUpdated'));
      } else {
        toast.error(res.error === 'error_insufficient_fc' ? (t.error_insufficient_fc || 'Not enough FC') : (t.rename_error || 'Error updating avatar'));
      }
      setIsSavingAvatar(false);
    });
  };

  const handleSaveName = () => {
    if (!newName.trim() || newName === teamName) { setIsEditingName(false); return; }
    startTransition(async () => {
      const res = await renameTeamAction(newName);
      if (res.success) {
        setTeamName(newName); setIsEditingName(false);
        toast.success(t.rename_success || 'Success');
        window.dispatchEvent(new Event('balanceUpdated'));
      } else {
        toast.error(res.error === 'error_censorship' ? t.error_censorship : res.error === 'error_insufficient_fc' ? t.error_insufficient_fc : t.rename_error || 'Error');
      }
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@twa-dev/sdk').then(m => { if (m.default.initDataUnsafe?.user) setTgUser(m.default.initDataUnsafe.user); });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && userId) {
      fetch(`/api/user/me?userId=${userId}`).then(r => r.json()).then(j => {
        setUserData(j.user);
        if (j.user?.manager_level) setManagerLevel(j.user.manager_level);
      }).catch(console.error);
    }
  }, [isAuthenticated, userId]);

  const triggerTour = () => {
    if (areAllToursSkipped()) return;
    startTour('profile', [
      {
        targetId: 'link-sweatbank',
        title: t.prof_tour_sweat || '🏃 Sweat Bank',
        description: t.prof_tour_sweat_desc || 'Здесь ты можешь синхронизировать свои шаги из реальной жизни и получать за них игровую валюту!',
      },
      {
        targetId: 'profile-wallet',
        title: t.prof_tour_wallet || '💎 Кошелек',
        description: t.prof_tour_wallet_desc || 'Привяжи свой кошелек, чтобы покупать и продавать игроков в виде NFT.',
      }
    ]);
  };

  useEffect(() => {
    const handleStartTour = () => triggerTour();
    window.addEventListener('startPageTour', handleStartTour);
    
    // Auto-start if never seen
    if (!hasSeenTour('profile')) {
      const timer = setTimeout(triggerTour, 500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('startPageTour', handleStartTour);
      };
    }
    
    return () => window.removeEventListener('startPageTour', handleStartTour);
  }, [hasSeenTour, areAllToursSkipped, startTour]);

  const shortenAddress = (a: string) => `${a.slice(0,4)}...${a.slice(-4)}`;

  return (
    <div className="flex flex-col h-full overflow-hidden text-white relative" style={{ background: '#05060f' }}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none bg-grid-cyan opacity-50" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(147,51,234,0.1)_0%,transparent_100%)]" />

      {/* ── Hero Card ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-3 pb-0 relative z-10">
        <motion.div
          className="glass-card-violet relative overflow-hidden p-3"
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="flex-shrink-0 relative group">
              <div className="w-14 h-14 hex-clip flex items-center justify-center overflow-hidden violet-glow-pulse"
                   style={{ background: 'linear-gradient(135deg, rgba(147,51,234,0.4), rgba(0,240,255,0.2))' }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Team" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-black font-orbitron text-white">{tgUser?.first_name?.charAt(0) || '?'}</span>
                )}
              </div>
              <button onClick={handleOpenAvatarModal}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#05060f] border border-violet-500/50
                           flex items-center justify-center hover:bg-violet-500/20 transition-colors">
                <Edit3 size={8} className="text-violet-400" />
              </button>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="text-[8px] text-violet-400/70 uppercase tracking-widest font-bold mb-0.5">{t.mgr_manager || 'Manager'}</div>
              <div className="text-sm font-black text-white font-orbitron truncate">
                {tgUser?.first_name} {tgUser?.last_name}
              </div>
              <div className="text-[8px] text-gray-600 font-mono">{t.id || 'ID'}: {tgUser?.id || userId || '—'}</div>
              <div className="mt-1.5">
                {userData?.wallet_address ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
                    <span className="font-mono text-emerald-300 text-[9px]">{shortenAddress(userData.wallet_address)}</span>
                  </div>
                ) : <div className="scale-90 origin-left"><WalletConnect /></div>}
              </div>
            </div>

            {/* Level + FC */}
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25">
                <span className="text-[7px] text-gray-500 font-bold uppercase">LVL</span>
                <span className="text-sm font-black font-orbitron text-cyan-300">{managerLevel}</span>
              </div>
              <div className="text-sm font-black font-orbitron text-yellow-400">{fcBalance.toLocaleString()}</div>
              <div className="text-[7px] text-yellow-500/70 font-bold">FC</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Primary SubNav ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 py-2 relative z-10">
        <SubNavTabs
          tabs={[
            { id: 'general', label: t.mgr_general || 'GENERAL' },
            { id: 'awards',  label: t.mgr_awards || 'AWARDS'  },
            { id: 'results', label: t.mgr_results || 'RESULTS' },
          ]}
          active={activeTab}
          onChange={(id) => setActiveTab(id as ManagerTab)}
          accent="violet"
        />
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-28 px-3 flex flex-col gap-3 relative z-10">

        {/* GENERAL Tab */}
        {activeTab === 'general' && (
          <>
            {/* Team Command */}
            <div className="glass-card p-3">
              <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold mb-2">{t.prof_franchise || 'Franchise'}</div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-cyan-500/25 bg-black/50 flex items-center justify-center flex-shrink-0">
                  {logoUrl ? <img src={logoUrl} alt="Team" className="w-full h-full object-cover" /> : <span className="text-lg">⚽</span>}
                </div>
                <div className="flex-1 min-w-0">
                  {isEditingName ? (
                    <div className="flex gap-2 items-center">
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                        className="bg-black/50 border border-violet-500/60 text-white px-2 py-1.5 rounded-lg text-sm font-orbitron w-full outline-none focus:border-violet-400"
                        maxLength={20} autoFocus />
                      <button onClick={handleSaveName} disabled={isPending}
                        className="w-7 h-7 flex items-center justify-center bg-violet-500 text-white rounded-lg text-xs font-black">
                        {isPending ? '…' : '✓'}
                      </button>
                      <button onClick={() => setIsEditingName(false)}
                        className="w-7 h-7 flex items-center justify-center bg-white/10 text-gray-300 rounded-lg text-xs">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white font-orbitron truncate">{teamName}</span>
                      <button onClick={() => { setIsEditingName(true); setNewName(teamName); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:border-violet-500/40 hover:bg-violet-500/10 transition-all group relative">
                        <Edit3 size={10} className="text-gray-500 group-hover:text-violet-400" />
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[7px] text-yellow-500 font-bold opacity-0 group-hover:opacity-100 whitespace-nowrap bg-black/80 px-1.5 py-0.5 rounded">1000 FC</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Board Objectives + Approval */}
            <div className="glass-card p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold mb-0.5">{t.mgr_board || 'Board Mandate'}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">{t.mgr_season_obj || 'Season Objectives'}</div>
                </div>
                <ApprovalRingMeter value={approvalRating} />
              </div>

              {objectives.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {objectives.map(obj => (
                    <div key={obj.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border uppercase ${PRIORITY_BADGE[obj.priority]}`}>
                            {obj.priority}
                          </span>
                          <span className="text-[9px] font-bold text-white">{obj.title}</span>
                        </div>
                        <div className="text-[8px] text-gray-500">{obj.competition} · {obj.target}</div>
                      </div>
                      <span className={`flex-shrink-0 text-[7px] font-black px-1.5 py-0.5 rounded-full border uppercase ${STATUS_BADGE[obj.status]}`}>
                        {obj.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-700 text-[10px] uppercase tracking-widest">{t.prof_loading_obj || 'Loading objectives...'}</div>
              )}
            </div>

            {/* Quick links row */}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/bank" id="link-sweatbank" className="glass-card p-3 flex flex-col gap-1.5 hover:border-yellow-500/30 transition-colors group">
                <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold">{t.mgr_sweat_bank || 'Sweat Bank'}</div>
                <div className="text-xs font-black text-yellow-400 group-hover:text-yellow-300">{t.mgr_open_vault || 'Open Vault'} →</div>
              </Link>
              <Link href="/staff" className="glass-card p-3 flex flex-col gap-1.5 hover:border-cyan-500/30 transition-colors group">
                <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold">{t.mgr_staff || 'Staff'}</div>
                <div className="text-xs font-black text-cyan-400 group-hover:text-cyan-300">{t.mgr_manage || 'Manage'} →</div>
              </Link>
            </div>

            {/* Settings grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="glass-card p-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[8px] text-gray-500 uppercase tracking-widest font-bold">
                  <Globe size={9} className="text-violet-400" />{t.language || 'Language'}
                </div>
                <div className="flex bg-black/40 rounded-lg border border-white/5 p-0.5">
                  {(['en','ru'] as const).map(lang => (
                    <button key={lang} onClick={() => setLanguage(lang)}
                      className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all ${language === lang ? 'bg-violet-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="glass-card p-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[8px] text-gray-500 uppercase tracking-widest font-bold">
                  <Bell size={9} className="text-cyan-400" />{t.notifications || 'Notifs'}
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <button onClick={() => setNotifications(!notifications)}
                    className={`w-12 h-6 rounded-full p-0.5 transition-all relative ${notifications ? 'bg-violet-500' : 'bg-white/10 border border-white/10'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${notifications ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              <div className="glass-card p-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[8px] text-gray-500 uppercase tracking-widest font-bold">
                  <Target size={9} className="text-yellow-400" />{t.tutorials || 'Tutorials'}
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <button onClick={() => {
                    if (confirm(t.prof_tour_confirm || 'Reset all tutorials forever?')) {
                      window.dispatchEvent(new Event('skipAllToursForever'));
                      toast.success(t.prof_tour_off_toast || 'Tutorials disabled!');
                    }
                  }} className="w-full h-6 rounded px-2 bg-yellow-500/10 text-yellow-500 text-[9px] font-bold uppercase transition-all hover:bg-yellow-500/20">
                    {t.prof_tour_off || 'Disable all'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2 w-full justify-between z-10" id="profile-wallet">
              <WalletConnect />
            </div>

            {/* Admin link */}
            {isAdmin && (
              <Link href="/admin/logs" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                bg-red-900/15 border border-red-500/25 text-red-400 uppercase tracking-widest text-[9px] font-bold hover:bg-red-900/30 transition-all">
                <Shield size={11} /> {t.mgr_dev_console || 'Developer Console'}
              </Link>
            )}

            {/* Resign + Legal */}
            <div className="mt-1">
              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                bg-red-500/5 border border-red-500/20 text-red-500/60
                text-[9px] font-bold uppercase tracking-widest hover:bg-red-500/10 transition-colors">
                <UserMinus size={11} /> {t.prof_resign || 'Resign as Manager'}
              </button>
            </div>

            <div className="pt-2 border-t border-white/5 flex justify-center gap-6 pb-2">
              <button onClick={() => setShowTerms(true)} className="text-[8px] text-gray-700 hover:text-violet-400 transition-colors uppercase tracking-widest flex items-center gap-1">
                <FileText size={8} /> {t.terms_of_use || 'Terms'}
              </button>
              <button onClick={() => setShowDisclaimer(true)} className="text-[8px] text-gray-700 hover:text-cyan-400 transition-colors uppercase tracking-widest flex items-center gap-1">
                <AlertTriangle size={8} /> {t.disclaimer || 'Disclaimer'}
              </button>
            </div>
          </>
        )}

        {/* AWARDS Tab */}
        {activeTab === 'awards' && (
          <div className="flex flex-col gap-3">
            <Link href="/achievements"
              className="glass-card flex items-center justify-between p-4 hover:border-yellow-500/30 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-yellow-600/30 to-yellow-900/20 border border-yellow-500/30">
                  <Award className="text-yellow-400" size={18} />
                </div>
                <div>
                  <div className="text-sm font-black text-white uppercase tracking-wider">{t.hall_of_fame || 'Hall of Fame'}</div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest">{t.your_achievements || 'Your achievements'}</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-600 group-hover:text-yellow-400 transition-colors" />
            </Link>

            {/* Trophy placeholders */}
            <div className="glass-card p-4 text-center">
              <Star className="text-gray-700 mx-auto mb-2" size={28} />
              <div className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">{t.trophies_soon || 'Trophies Coming Soon'}</div>
              <div className="text-[9px] text-gray-700 mt-1">{t.win_comps || 'Win competitions to earn cups & medals'}</div>
            </div>
          </div>
        )}

        {/* RESULTS Tab */}
        {activeTab === 'results' && (
          <div className="glass-card p-4 text-center">
            <TrendingUp className="text-gray-700 mx-auto mb-2" size={28} />
            <div className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">{t.match_history || 'Match History'}</div>
            <div className="text-[9px] text-gray-700 mt-1">{t.season_results || 'Season results will appear here'}</div>
            <Link href="/" className="mt-3 block text-[9px] font-bold text-cyan-400 uppercase tracking-wider hover:text-cyan-300">
              {t.go_dashboard || '→ Go to Dashboard'}
            </Link>
          </div>
        )}
      </div>

      {/* ── Modals ── (reused from original, condensed) */}
      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-md" onClick={() => setShowTerms(false)}>
          <div className="w-full max-w-[480px] glass-card rounded-b-none p-6 relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
            <button onClick={() => setShowTerms(false)} className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><X size={14} /></button>
            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm font-orbitron">{t.terms_of_use || 'Terms'}</h3>
            <div className="text-[10px] text-gray-400 space-y-3 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              <p>{t.prof_terms_desc_1 || 'In-game currency (FanCoins, SP) has no real-world financial value outside our TON marketplace.'}</p>
              <p>{t.prof_terms_desc_2 || 'Developers reserve the right to ban accounts for fraud, step manipulation or forbidden content.'}</p>
            </div>
            <button onClick={() => setShowTerms(false)} className="w-full py-2.5 bg-violet-500 text-white font-bold uppercase tracking-widest text-xs rounded-xl">{t.prof_close || 'Close'}</button>
          </div>
        </div>
      )}

      {showDisclaimer && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-md" onClick={() => setShowDisclaimer(false)}>
          <div className="w-full max-w-[480px] glass-card rounded-b-none p-6 relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
            <button onClick={() => setShowDisclaimer(false)} className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><X size={14} /></button>
            <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm font-orbitron">{t.disclaimer || 'Disclaimer'}</h3>
            <div className="text-[10px] text-gray-400 space-y-3 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              <p><strong className="text-violet-300">Medical:</strong> {t.prof_disc_desc_1 || 'This app is for entertainment only and is not a medical device.'}</p>
              <p><strong className="text-cyan-300">Crypto:</strong> {t.prof_disc_desc_2 || 'We are not an exchange or broker. TON purchases are in-game transactions.'}</p>
            </div>
            <button onClick={() => setShowDisclaimer(false)} className="w-full py-2.5 bg-cyan-500 text-black font-bold uppercase tracking-widest text-xs rounded-xl">{t.prof_close || 'Close'}</button>
          </div>
        </div>
      )}

      {showAvatarModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-md" onClick={() => setShowAvatarModal(false)}>
          <div className="w-full max-w-[480px] glass-card-violet rounded-b-none p-6 flex flex-col items-center gap-4 relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
            <h3 className="text-white font-bold text-sm uppercase tracking-widest font-orbitron">{t.prof_avatar_gen || 'Avatar Generator'}</h3>
            <div className="w-20 h-20 hex-clip overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(147,51,234,0.3),rgba(0,240,255,0.2))' }}>
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="w-full">
              <label className="text-[8px] text-gray-500 uppercase tracking-widest mb-1 block">{t.prof_seed || 'Seed'}</label>
              <input type="text" value={avatarSeed} onChange={e => setAvatarSeed(e.target.value)}
                className="w-full bg-black/50 border border-violet-500/50 text-white px-3 py-2 rounded-lg text-xs font-orbitron focus:border-violet-400 outline-none" />
            </div>
            <div className="flex gap-2 w-full">
              <button onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
                className="flex-1 py-2 bg-white/5 border border-white/10 text-gray-300 text-[9px] uppercase font-bold tracking-widest rounded-xl hover:bg-white/10">
                {t.prof_randomize || 'Randomize'}
              </button>
              <button onClick={handleSaveAvatar} disabled={isSavingAvatar}
                className="flex-1 py-2 bg-yellow-500 text-black text-[9px] uppercase font-black tracking-widest rounded-xl hover:bg-yellow-400 disabled:opacity-50">
                {isSavingAvatar ? '...' : (t.prof_save_fc || 'Save (500 FC)')}
              </button>
            </div>
            <button onClick={() => setShowAvatarModal(false)} className="text-gray-600 text-[8px] uppercase tracking-widest hover:text-white transition-colors">{t.prof_cancel_btn || 'Cancel'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
