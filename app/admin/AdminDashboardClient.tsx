'use client';

import React, { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { resolveLog, updateAdminNote } from '@/app/actions/logActions';
import { 
  addFanCoins, addManagerXp, maxEnergy, generateTopPlayer, forceMatchWin, hardResetUserTeam, seedBotLeague 
} from '@/app/actions/adminActions';
import { 
  CheckCircle, AlertTriangle, Info, ShieldAlert, ChevronDown, ChevronUp, Search, Check, 
  Terminal, Shield, Zap, Coins, Users, Activity, Trophy, Skull
} from 'lucide-react';
import toast from 'react-hot-toast';

type AdminTab = 'logs' | 'cheats';

export default function AdminDashboardClient({ initialLogs }: { initialLogs: any[] }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('logs');

  // Logs State
  const [logs, setLogs] = useState(initialLogs);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterResolved, setFilterResolved] = useState('unresolved');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Cheats State
  const [isPending, startTransition] = useTransition();

  // ── Logs Handlers ────────────────────────────────────────────────────────
  const handleResolve = async (id: string) => {
    setLogs(logs.map(l => l.id === id ? { ...l, resolved: true } : l));
    await resolveLog(id, false);
  };

  const handleSaveNote = async (id: string) => {
    setSavingId(id);
    const res = await updateAdminNote(id, noteValue, false);
    if (res.success) {
      setLogs(logs.map(l => l.id === id ? { ...l, admin_notes: noteValue } : l));
      setEditingNoteId(null);
    }
    setSavingId(null);
  };

  const startEditingNote = (log: any) => {
    setEditingNoteId(log.id);
    setNoteValue(log.admin_notes || '');
  };

  const filteredLogs = logs.filter(log => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterResolved === 'resolved' && !log.resolved) return false;
    if (filterResolved === 'unresolved' && log.resolved) return false;
    return true;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical': return <ShieldAlert size={16} className="text-red-500" />;
      case 'error': return <AlertTriangle size={16} className="text-orange-500" />;
      case 'warning': return <AlertTriangle size={16} className="text-yellow-500" />;
      default: return <Info size={16} className="text-blue-500" />;
    }
  };

  // ── Cheats Handlers ──────────────────────────────────────────────────────
  const handleCheat = (action: () => Promise<any>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    
    startTransition(async () => {
      const res = await action();
      if (res.success) {
        toast.success(res.message || 'Success!');
      } else {
        toast.error(res.error || 'Failed');
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full p-6">
      
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Terminal className="text-violet-500" /> Admin Console
        </h1>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'logs' ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Shield size={16} /> System Logs
          </button>
          <button 
            onClick={() => setActiveTab('cheats')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
              activeTab === 'cheats' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Zap size={16} /> Dev Tools (Cheats)
          </button>
        </div>
      </div>

      {/* ── LOGS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
            <select 
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>

            <select 
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              value={filterResolved}
              onChange={e => setFilterResolved(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="unresolved">Unresolved Only</option>
              <option value="resolved">Resolved Only</option>
            </select>
            
            <div className="ml-auto text-gray-400 text-sm flex items-center gap-2 font-bold bg-black/40 px-3 rounded-lg border border-white/5">
              <Search size={14} /> {filteredLogs.length} logs
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/50 text-gray-400 text-xs uppercase tracking-widest border-b border-gray-800">
                    <th className="p-4 font-bold">Level</th>
                    <th className="p-4 font-bold">Time</th>
                    <th className="p-4 font-bold">Source</th>
                    <th className="p-4 font-bold w-1/3">Message</th>
                    <th className="p-4 font-bold">Notes</th>
                    <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <React.Fragment key={log.id}>
                      <tr className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${log.resolved ? 'opacity-50' : ''}`}>
                        <td className="p-4 flex items-center gap-2">
                          {getLevelIcon(log.level)}
                          <span className="capitalize font-bold text-xs">{log.level}</span>
                        </td>
                        <td className="p-4 text-xs text-gray-300 font-mono">
                          {format(new Date(log.created_at), 'dd MMM, HH:mm:ss')}
                        </td>
                        <td className="p-4 text-xs font-mono text-cyan-400">{log.source}</td>
                        <td className="p-4 text-xs truncate max-w-[200px] text-gray-200" title={log.message}>
                          {log.message}
                        </td>
                        <td className="p-4">
                          {editingNoteId === log.id ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                value={noteValue}
                                onChange={e => setNoteValue(e.target.value)}
                                className="bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white w-full"
                                placeholder="Add comment..."
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleSaveNote(log.id)}
                              />
                              <button onClick={() => handleSaveNote(log.id)} disabled={savingId === log.id} className="text-emerald-500 hover:text-emerald-400">
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <div 
                              className="text-xs text-gray-500 italic cursor-pointer hover:text-gray-300 truncate max-w-[150px]"
                              onClick={() => startEditingNote(log)}
                            >
                              {log.admin_notes || 'Add note...'}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-3">
                          {!log.resolved && (
                            <button 
                              onClick={() => handleResolve(log.id)}
                              className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 text-[10px] uppercase font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md"
                            >
                              <CheckCircle size={12} /> Resolve
                            </button>
                          )}
                          <button 
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="text-gray-400 hover:text-white p-1 bg-white/5 rounded"
                          >
                            {expandedId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      
                      {expandedId === log.id && (
                        <tr className="bg-black/60 border-b border-gray-800">
                          <td colSpan={6} className="p-6">
                            <div className="flex flex-col gap-4">
                              <div>
                                <h4 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Full Message</h4>
                                <div className="text-white text-sm bg-black p-3 rounded-lg border border-gray-800 whitespace-pre-wrap font-mono text-xs">
                                  {log.message}
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Metadata / Stack Trace</h4>
                                <pre className="text-cyan-400 text-xs bg-black p-4 rounded-lg border border-gray-800 overflow-x-auto font-mono">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-500 font-bold uppercase tracking-widest text-sm">
                        No logs found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CHEATS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'cheats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          <div className="glass-card p-5 flex flex-col gap-3 border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-center gap-2 text-yellow-500 mb-2">
              <Coins size={20} /> <h3 className="font-bold uppercase tracking-wider text-sm">Economy</h3>
            </div>
            <button 
              disabled={isPending}
              onClick={() => handleCheat(() => addFanCoins(5000))}
              className="w-full py-3 rounded-xl bg-yellow-500/20 text-yellow-400 font-bold uppercase text-xs hover:bg-yellow-500/30 transition-colors"
            >
              Add 5000 FanCoins
            </button>
          </div>

          <div className="glass-card p-5 flex flex-col gap-3 border-violet-500/30 bg-violet-500/5">
            <div className="flex items-center gap-2 text-violet-400 mb-2">
              <Activity size={20} /> <h3 className="font-bold uppercase tracking-wider text-sm">Manager</h3>
            </div>
            <button 
              disabled={isPending}
              onClick={() => handleCheat(() => addManagerXp(1000))}
              className="w-full py-3 rounded-xl bg-violet-500/20 text-violet-300 font-bold uppercase text-xs hover:bg-violet-500/30 transition-colors"
            >
              Add 1000 Manager XP
            </button>
          </div>

          <div className="glass-card p-5 flex flex-col gap-3 border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <Zap size={20} /> <h3 className="font-bold uppercase tracking-wider text-sm">Team Condition</h3>
            </div>
            <button 
              disabled={isPending}
              onClick={() => handleCheat(() => maxEnergy())}
              className="w-full py-3 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold uppercase text-xs hover:bg-emerald-500/30 transition-colors"
            >
              Max Energy / Heal All
            </button>
          </div>

          <div className="glass-card p-5 flex flex-col gap-3 border-cyan-500/30 bg-cyan-500/5">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <Users size={20} /> <h3 className="font-bold uppercase tracking-wider text-sm">Roster</h3>
            </div>
            <button 
              disabled={isPending}
              onClick={() => handleCheat(() => generateTopPlayer())}
              className="w-full py-3 rounded-xl bg-cyan-500/20 text-cyan-300 font-bold uppercase text-xs hover:bg-cyan-500/30 transition-colors"
            >
              Generate Top Player
            </button>
          </div>

          <div className="glass-card p-5 flex flex-col gap-3 border-blue-500/30 bg-blue-500/5">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Trophy size={20} /> <h3 className="font-bold uppercase tracking-wider text-sm">Match Engine</h3>
            </div>
            <button 
              disabled={isPending}
              onClick={() => handleCheat(() => forceMatchWin())}
              className="w-full py-3 rounded-xl bg-blue-500/20 text-blue-300 font-bold uppercase text-xs hover:bg-blue-500/30 transition-colors"
            >
              Force Win (+3 Pts)
            </button>
          </div>

          <div className="glass-card p-5 flex flex-col gap-3 border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <Skull size={20} /> <h3 className="font-bold uppercase tracking-wider text-sm">Danger Zone</h3>
            </div>
            <button 
              disabled={isPending}
              onClick={() => handleCheat(() => seedBotLeague(), "Spawn 13 bots in your league?")}
              className="w-full py-2 rounded-xl bg-orange-500/20 text-orange-400 font-bold uppercase text-xs hover:bg-orange-500/30 transition-colors mb-2"
            >
              Seed League (13 Bots)
            </button>
            <button 
              disabled={isPending}
              onClick={() => handleCheat(async () => {
                const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
                if (!tgId) return { success: false, error: 'No Telegram ID found' };
                return hardResetUserTeam(tgId);
              }, "Are you absolutely sure? This will wipe your team and players permanently.")}
              className="w-full py-2 rounded-xl bg-red-600 text-white font-bold uppercase text-xs hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)]"
            >
              Hard Reset My Team
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
