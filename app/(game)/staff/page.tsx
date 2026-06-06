'use client';

import { useContext, useEffect, useState } from 'react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { SubNavTabs } from '@/components/ui/SubNavTabs';
import { getStaffAction, fireStaffAction, hireStaffAction, type StaffMember } from '@/app/actions/staffActions';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { UserX, UserPlus, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// STAFF PAGE — Coaches & Scouts management
// Primary SubNav: COACHES | SCOUTS
// Secondary SubNav: FIRST TEAM | ACADEMY
// ─────────────────────────────────────────────────────────────────────────────

type PrimaryTab = 'coaches' | 'scouts';
type DepartmentTab = 'first_team' | 'academy';

const ROLE_LABELS: Record<StaffMember['role'], string> = {
  head_coach:       'HEAD COACH',
  assistant_coach:  'ASST. COACH',
  gk_coach:         'GK COACH',
  fitness_coach:    'FIT. COACH',
  scout:            'SCOUT',
};

const ROLE_COLORS: Record<StaffMember['role'], string> = {
  head_coach:       'text-cyan-300 bg-cyan-500/15 border-cyan-500/40',
  assistant_coach:  'text-violet-300 bg-violet-500/15 border-violet-500/40',
  gk_coach:         'text-yellow-300 bg-yellow-500/15 border-yellow-500/40',
  fitness_coach:    'text-emerald-300 bg-emerald-500/15 border-emerald-500/40',
  scout:            'text-orange-300 bg-orange-500/15 border-orange-500/40',
};

function AttrBar({ value, label }: { value: number; label: string }) {
  const color = value >= 70 ? 'bg-cyan-400' : value >= 50 ? 'bg-violet-400' : 'bg-gray-600';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[7px] text-gray-600 uppercase font-bold">{label}</span>
      <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[9px] font-black font-orbitron text-white">{value}</span>
    </div>
  );
}

function StaffCard({ member, onFire }: { member: StaffMember; onFire: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const contractDate = new Date(member.contract_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const overall = Math.round(
    (member.attr_def + member.attr_pas + member.attr_sho +
     member.attr_pac + member.attr_phy + member.attr_men + member.attr_gkp) / 7
  );

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
        {/* Avatar circle with overall */}
        <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center
                        bg-gradient-to-br from-violet-900/40 to-black/60 border border-violet-500/25
                        relative overflow-hidden">
          <span className="text-lg font-black font-orbitron text-violet-300">{overall}</span>
          <div className="absolute bottom-0 left-0 right-0 text-[6px] text-center font-bold text-violet-500/60 pb-0.5 uppercase">OVR</div>
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
            <span className="text-[8px] text-gray-600">🏳 {member.nationality}</span>
            <span className="text-[8px] text-gray-600">Age {member.age}</span>
          </div>
        </div>

        {/* Contract + chevron */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="text-[8px] text-gray-600 uppercase tracking-wider">until {contractDate}</span>
          <span className="text-[9px] text-emerald-400 font-bold">{member.salary_per_match} FC/match</span>
        </div>
        <ChevronRight
          size={14}
          className={`text-gray-600 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {/* Expanded: Attribute grid + Actions */}
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
              {/* Attribute bars */}
              <div className="flex justify-between mb-3">
                <AttrBar value={member.attr_def} label="DEF" />
                <AttrBar value={member.attr_pas} label="PAS" />
                <AttrBar value={member.attr_sho} label="SHO" />
                <AttrBar value={member.attr_pac} label="PAC" />
                <AttrBar value={member.attr_phy} label="PHY" />
                <AttrBar value={member.attr_men} label="MEN" />
                <AttrBar value={member.attr_gkp} label="GKP" />
              </div>

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
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                             bg-white/5 border border-white/10 text-gray-400
                             text-[9px] font-black uppercase tracking-wider
                             hover:bg-white/10 transition-colors active:scale-95"
                >
                  Renew Contract
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

  const [primaryTab,   setPrimaryTab]   = useState<PrimaryTab>('coaches');
  const [deptTab,      setDeptTab]      = useState<DepartmentTab>('first_team');
  const [staff,        setStaff]        = useState<StaffMember[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isHiring,     setIsHiring]     = useState(false);

  const loadStaff = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    const res = await getStaffAction(deptTab);
    if (res.success && res.data) setStaff(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && userId) loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId, deptTab]);

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
    const role = primaryTab === 'scouts' ? 'scout' : 'assistant_coach';
    const res = await hireStaffAction(role, deptTab);
    if (res.success && res.data) {
      toast.success(`${res.data.name} hired!`);
      setStaff(prev => [...prev, res.data!]);
    } else {
      toast.error(res.error ?? 'Failed to hire');
    }
    setIsHiring(false);
  };

  // Filter by primary tab
  const filtered = staff.filter(s =>
    primaryTab === 'scouts' ? s.role === 'scout' : s.role !== 'scout'
  );

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
              <h1 className="text-sm font-black font-orbitron text-white uppercase tracking-widest">Staff Management</h1>
              <p className="text-[9px] text-violet-400/70 uppercase tracking-wider mt-0.5">
                {filtered.length} member{filtered.length !== 1 ? 's' : ''} · {deptTab.replace('_', ' ')}
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

      {/* Primary SubNav: COACHES | SCOUTS */}
      <div className="flex-shrink-0 py-2 relative z-10">
        <SubNavTabs
          tabs={[
            { id: 'coaches', label: 'COACHES' },
            { id: 'scouts',  label: 'SCOUTS'  },
          ]}
          active={primaryTab}
          onChange={(id) => setPrimaryTab(id as PrimaryTab)}
          accent="violet"
        />
      </div>

      {/* Secondary SubNav: FIRST TEAM | ACADEMY */}
      <div className="flex-shrink-0 pb-2 relative z-10">
        <SubNavTabs
          tabs={[
            { id: 'first_team', label: 'FIRST TEAM' },
            { id: 'academy',    label: 'ACADEMY'     },
          ]}
          active={deptTab}
          onChange={(id) => setDeptTab(id as DepartmentTab)}
          accent="cyan"
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
            <p className="text-gray-600 text-xs uppercase tracking-widest font-bold">No staff in this department</p>
            <button
              onClick={handleHire}
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
