'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { resolveLog, updateAdminNote } from '@/app/actions/logActions';
import { CheckCircle, AlertTriangle, Info, ShieldAlert, ChevronDown, ChevronUp, Save, Search, Check } from 'lucide-react';

export default function LogViewerClient({ initialLogs }: { initialLogs: any[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterResolved, setFilterResolved] = useState('unresolved');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Note editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

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
      case 'critical': return <ShieldAlert className="text-red-500" />;
      case 'error': return <AlertTriangle className="text-orange-500" />;
      case 'warning': return <AlertTriangle className="text-yellow-500" />;
      default: return <Info className="text-blue-500" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
        <select 
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
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
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
          value={filterResolved}
          onChange={e => setFilterResolved(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="unresolved">Unresolved Only</option>
          <option value="resolved">Resolved Only</option>
        </select>
        
        <div className="ml-auto text-gray-400 flex items-center gap-2">
          <Search size={18} /> Showing {filteredLogs.length} logs
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-950 text-gray-400 text-sm border-b border-gray-800">
                <th className="p-4 font-medium">Level</th>
                <th className="p-4 font-medium">Time</th>
                <th className="p-4 font-medium">Source</th>
                <th className="p-4 font-medium w-1/3">Message</th>
                <th className="p-4 font-medium">Notes</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <React.Fragment key={log.id}>
                  <tr className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${log.resolved ? 'opacity-50' : ''}`}>
                    <td className="p-4 flex items-center gap-2">
                      {getLevelIcon(log.level)}
                      <span className="capitalize font-bold text-sm">{log.level}</span>
                    </td>
                    <td className="p-4 text-sm text-gray-300">
                      {format(new Date(log.created_at), 'dd MMM, HH:mm')}
                    </td>
                    <td className="p-4 text-sm font-mono text-blue-400">{log.source}</td>
                    <td className="p-4 text-sm truncate max-w-[200px] text-gray-200" title={log.message}>
                      {log.message}
                    </td>
                    <td className="p-4">
                      {editingNoteId === log.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text"
                            value={noteValue}
                            onChange={e => setNoteValue(e.target.value)}
                            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white w-full"
                            placeholder="Add comment..."
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleSaveNote(log.id)}
                          />
                          <button onClick={() => handleSaveNote(log.id)} disabled={savingId === log.id} className="text-green-500 hover:text-green-400">
                            <Check size={18} />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="text-sm text-gray-400 italic cursor-pointer hover:text-gray-200 truncate max-w-[150px]"
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
                          className="text-green-500 hover:text-green-400 flex items-center gap-1 text-sm font-bold bg-green-500/10 px-2 py-1 rounded"
                        >
                          <CheckCircle size={16} /> Resolve
                        </button>
                      )}
                      <button 
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        {expandedId === log.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded View */}
                  {expandedId === log.id && (
                    <tr className="bg-gray-950/80 border-b border-gray-800">
                      <td colSpan={6} className="p-6">
                        <div className="flex flex-col gap-4">
                          <div>
                            <h4 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Full Message</h4>
                            <div className="text-white text-sm bg-black/50 p-3 rounded-lg border border-gray-800 whitespace-pre-wrap">
                              {log.message}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Metadata / Stack Trace</h4>
                            <pre className="text-green-400 text-xs bg-black/80 p-4 rounded-lg border border-gray-800 overflow-x-auto">
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
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No logs found matching criteria.
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
