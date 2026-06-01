'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { resolveLog, updateAdminNote } from '@/app/actions/logActions';
import { CheckCircle, Bug, ChevronDown, ChevronUp, Search, Check, User } from 'lucide-react';

export default function BugViewerClient({ initialBugs }: { initialBugs: any[] }) {
  const [bugs, setBugs] = useState(initialBugs);
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Note editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleResolve = async (id: string) => {
    setBugs(bugs.map(b => b.id === id ? { ...b, status: 'resolved' } : b));
    await resolveLog(id, true);
  };

  const handleSaveNote = async (id: string) => {
    setSavingId(id);
    const res = await updateAdminNote(id, noteValue, true);
    if (res.success) {
      setBugs(bugs.map(b => b.id === id ? { ...b, admin_notes: noteValue } : b));
      setEditingNoteId(null);
    }
    setSavingId(null);
  };

  const startEditingNote = (bug: any) => {
    setEditingNoteId(bug.id);
    setNoteValue(bug.admin_notes || '');
  };

  const filteredBugs = bugs.filter(bug => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'resolved' && bug.status !== 'resolved') return false;
      if (filterStatus === 'unresolved' && bug.status === 'resolved') return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <select 
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="unresolved">Unresolved Only</option>
          <option value="resolved">Resolved Only</option>
        </select>
        
        <div className="ml-auto text-gray-400 flex items-center gap-2">
          <Search size={18} /> Showing {filteredBugs.length} reports
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-950 text-gray-400 text-sm border-b border-gray-800">
                <th className="p-4 font-medium w-[100px]">Status</th>
                <th className="p-4 font-medium w-[150px]">Time</th>
                <th className="p-4 font-medium w-[150px]">User</th>
                <th className="p-4 font-medium w-1/3">Description</th>
                <th className="p-4 font-medium">Notes</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBugs.map(bug => (
                <React.Fragment key={bug.id}>
                  <tr className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${bug.status === 'resolved' ? 'opacity-50' : ''}`}>
                    <td className="p-4 flex items-center gap-2">
                      <Bug className={bug.status === 'resolved' ? 'text-gray-500' : 'text-red-500'} />
                      <span className="capitalize font-bold text-sm">{bug.status}</span>
                    </td>
                    <td className="p-4 text-sm text-gray-300">
                      {format(new Date(bug.created_at), 'dd MMM, HH:mm')}
                    </td>
                    <td className="p-4 text-sm text-gray-400 flex items-center gap-2">
                      <User size={14} />
                      <span className="truncate max-w-[120px]" title={bug.user_id}>
                        {bug.users?.telegram_id || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-4 text-sm truncate max-w-[200px] text-gray-200" title={bug.description}>
                      {bug.description}
                    </td>
                    <td className="p-4">
                      {editingNoteId === bug.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text"
                            value={noteValue}
                            onChange={e => setNoteValue(e.target.value)}
                            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white w-full"
                            placeholder="Add comment..."
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleSaveNote(bug.id)}
                          />
                          <button onClick={() => handleSaveNote(bug.id)} disabled={savingId === bug.id} className="text-green-500 hover:text-green-400">
                            <Check size={18} />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="text-sm text-gray-400 italic cursor-pointer hover:text-gray-200 truncate max-w-[150px]"
                          onClick={() => startEditingNote(bug)}
                        >
                          {bug.admin_notes || 'Add note...'}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-3">
                      {bug.status !== 'resolved' && (
                        <button 
                          onClick={() => handleResolve(bug.id)}
                          className="text-green-500 hover:text-green-400 flex items-center gap-1 text-sm font-bold bg-green-500/10 px-2 py-1 rounded"
                        >
                          <CheckCircle size={16} /> Resolve
                        </button>
                      )}
                      <button 
                        onClick={() => setExpandedId(expandedId === bug.id ? null : bug.id)}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        {expandedId === bug.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded View */}
                  {expandedId === bug.id && (
                    <tr className="bg-gray-950/80 border-b border-gray-800">
                      <td colSpan={6} className="p-6">
                        <div className="flex flex-col gap-4">
                          <div>
                            <h4 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Full Description</h4>
                            <div className="text-white text-sm bg-black/50 p-3 rounded-lg border border-gray-800 whitespace-pre-wrap">
                              {bug.description}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Browser Metadata</h4>
                            <pre className="text-blue-400 text-xs bg-black/80 p-4 rounded-lg border border-gray-800 overflow-x-auto">
                              {JSON.stringify(bug.metadata, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              
              {filteredBugs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No bugs found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
