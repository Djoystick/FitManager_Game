'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { SubNavTabs } from '@/components/ui/SubNavTabs';
import { getStaffAction, fireStaffAction, hireStaffAction, type StaffMember } from '@/app/actions/staffActions';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { UserX, UserPlus, ChevronRight, Star, Clock, Coins } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// STAFF PAGE — New system with roles, star ratings, and contracts
// ─────────────────────────────────────────────────────────────────────────────

type StaffTab = 'all' | 'youth_coach' | 'head_coach' | 'medical_staff' | 'head_scout';

const ROLE_LABELS: Record<StaffMember['role'], string> = {
  youth_coach:    'YOUTH COACH',
  head_coach:     'HEAD COACH',
  medical_staff:  'MEDICAL',
  head_scout:     'HEAD SCOUT',
};

const ROLE_COLORS: Record<StaffMember['role'], string> = {
  youth_coach:    'text-emerald-300 bg-emerald-500/15 border-emerald-500/40',
  head_coach:     'text-cyan-300 bg-cyan-500/15 border-cyan-500/40',
  medical_staff:  'text-pink-300 bg-pink-500/15 border-pink-500/40',
  head_scout:     'text-orange-300 bg-orange-500/15 border-orange-500/40',
};

const ROLE_DESCRIPTIONS: Record<StaffMember['role'], string> = {
  youth_coach:    'Boosts youth player stat growth',
  head_coach:     'OVR bonus in match engine',
  medical_staff:  'Passive stamina recovery daily',
  head_scout:     'Archetype scouting guarantee',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={10} className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'} />
      ))}
    </div>
  );
}

function StaffCard({ member, onFire }: { member: StaffMember; onFire: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const weeksLeft = member.weeks_remaining;
  const contractLabel = `${weeksLeft}w left`;

  // Compute effective bonus text based on role
  let bonusText = '';
  if (member.role === 'youth_coach') {
    const staBonus = member.attr_sta > 60 ? '+1 growth/day' : '';
    const agiBonus = member.attr_agi > 60 ? '+1 growth/day' : '';
    bonusText = [staBonus, agiBonus].filter(Boolean).join(', ') || 'No bonus';
  } else if (member.role === 'head_coach') {
    bonusText = `+${member.attr_ovr_bonus}% OVR`;
  } else if (member.role === 'medical_staff') {
    bonusText = `+${member.attr_recovery} stamina/day`;
  } else {
    bonusText = 'Archetype scouting';
  }

  return (
    <motion.div
      className="glass-card-violet overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Star badge */}
        <div className="w-12 h-12 rounded-xl flex-shrink-0 flex flex-col items-center justify-center
                        bg-gradient-to-br from-violet-900/40 to-black/60 border border-violet-500/25">
          <StarRating rating={member.star_rating} />
          <span className="text-[7px] text-gray-600 mt-0.5">{member.star_rating}★</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-black text-white font-orbitron uppercase tracking-wide truncate">
              {member.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border uppercase ${ROLE_COLORS[member.role]}`}>
              {ROLE_LABELS[member.role]}
            </span>
          </div>
          <div className="text-[8px] text-gray-600 mt-0.5">{ROLE_DESCRIPTIONS[member.role]}</div>
        </div>

        {/* Contract + Salary */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <Clock size={8} className="text-gray-600" />
            <span className="text-[8px] text-gray-600">{contractLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Coins size={8} className="text-yellow-500" />
            <span className="text-[9px] text-yellow-400 font-bold">{member.salary_per_week}/wk</span>
          </div>
        </div>
        <ChevronRight
          size={14}
          className={`text-gray-600 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {/* Expanded: Bonus details + Actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-white/5 pt-3">
              {/* Bonus info */}
              <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[8px] text-gray-500 uppercase font-bold">Active Bonus:</span>
                <span className="text-[9px] text-cyan-400 font-bold">{bonusText}</span>
              </div>

              {/* Role-specific attributes */}
              {member.role === 'youth_coach' && (
                <div className="flex gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-[7px] text-gray-600 uppercase">STA Coaching</div>
                    <div className="text-sm font-black font-orbitron text-white">{member.attr_sta}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[7px] text-gray-600 uppercase">AGI Coaching</div>
                    <div className="text-sm font-black font-orbitron text-white">{member.attr_agi}</div>
                  </div>
                </div>
              )}
              {member.role === 'head_coach' && (
                <div className="flex gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-[7px] text-gray-600 uppercase">OVR Bonus</div>
                    <div className="text-sm font-black font-orbitron text-cyan-300">+{member.attr_ovr_bonus}%</div>
                  </div>
                </div>
              )}
              {member.role === 'medical_staff' && (
                <div className="flex gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-[7px] text-gray-600 uppercase">Recovery/Day</div>
                    <div className="text-sm font-black font-orbitron text-pink-300">+{member.attr_recovery}</div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onFire(member.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                             bg-red-900/20 border border-red-500/30 text-red-400
                             text-[9px] font-black uppercase tracking-wider
                             hover:bg-red-900/40 transition-colors active:scale-95"
                >
                  <UserX size={12} />
                  Release
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function StaffPage() {
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);

  const [activeTab,   setActiveTab]   = useState<StaffTab>('all');
  const [staff,       setStaff]       = useState<StaffMember[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isHiring,    setIsHiring]    = useState(false);

  const loadStaff = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    const res = await getStaffAction();
    if (res.success && res.data) setStaff(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && userId) loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId]);

  const handleFire = async (id: string) => {
    const res = await fireStaffAction(id);
    if (res.success) {
      toast.success('Staff member released');
      setStaff(prev => prev.filter(s => s.id !== id));
    } else {
      toast.error(res.error ?? 'Failed to release');
    }
  };

  const handleHire = async () => {
    setIsHiring(true);
    // Hire based on active tab, default to youth_coach
    const roleMap: Record<string, StaffMember['role']> = {
      all: 'youth_coach',
      youth_coach: 'youth_coach',
      head_coach: 'head_coach',
      medical_staff: 'medical_staff',
      head_scout: 'head_scout',
    };
    const role = roleMap[activeTab] ?? 'youth_coach';
    const res = await hireStaffAction(role);
    if (res.success && res.data) {
      toast.success(`${res.data.name} hired! (${res.data.star_rating}★)`);
      setStaff(prev => [...prev, res.data!]);
    } else {
      toast.error(res.error ?? 'Failed to hire');
    }
    setIsHiring(false);
  };

  // Filter by tab
  const filtered = activeTab === 'all' ? staff : staff.filter(s => s.role === activeTab);
  const totalSalary = staff.reduce((sum, s) => sum + s.salary_per_week, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#05060f' }}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none bg-grid-cyan opacity-60" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_30%_at_50%_0%,rgba(147,51,234,0.1)_0%,transparent_100%)]" />

      {/* Header */}
      <header className="flex-shrink-0 px-3 pt-3 pb-2 relative z-10">
        <div className="glass-card-violet relative overflow-hidden p-3">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-black font-orbitron text-white uppercase tracking-widest">Staff</h1>
              <p className="text-[9px] text-violet-400/70 uppercase tracking-wider mt-0.5">
                {staff.length} hired · {totalSalary} FC/week total salary
              </p>
            </div>
            <button
              onClick={handleHire}
              disabled={isHiring}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         bg-cyan-500/15 border border-cyan-500/40 text-cyan-300
                         text-[9px] font-black uppercase tracking-wider
                         hover:bg-cyan-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              <UserPlus size={12} />
              {isHiring ? '...' : 'HIRE'}
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex-shrink-0 py-2 relative z-10">
        <SubNavTabs
          tabs={[
            { id: 'all',            label: 'ALL' },
            { id: 'youth_coach',    label: 'YOUTH' },
            { id: 'head_coach',     label: 'COACH' },
            { id: 'medical_staff',  label: 'MEDICAL' },
            { id: 'head_scout',     label: 'SCOUT' },
          ]}
          active={activeTab}
          onChange={(id) => setActiveTab(id as StaffTab)}
          accent="violet"
        />
      </div>

      {/* Staff list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-28 px-3 flex flex-col gap-3 relative z-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center">
              <UserPlus className="text-gray-700" size={24} />
            </div>
            <p className="text-gray-600 text-xs uppercase tracking-widest font-bold">
              {activeTab === 'all' ? 'No staff hired yet' : `No ${ROLE_LABELS[activeTab]?.toLowerCase()}s`}
            </p>
            <button
              onClick={handleHire}
              disabled={isHiring}
              className="px-4 py-2 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300
                         rounded-xl text-[10px] font-black uppercase tracking-wider
                         hover:bg-cyan-500/25 transition-colors"
            >
              Hire Now
            </button>
          </div>
        ) : (
          filtered.map(member => (
            <StaffCard key={member.id} member={member} onFire={handleFire} />
          ))
        )}
      </div>
    </div>
  );
}
