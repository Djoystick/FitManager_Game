'use client';

import { useState } from 'react';
import { submitBugReport } from '@/app/actions/logActions';
import { Bug, X, Loader2 } from 'lucide-react';

export default function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    
    // Attempt to get user ID from cookie or local storage if possible
    // For now we pass null, and the backend/action can read cookies if needed,
    // or we just rely on client info.
    const userId = null; // Next server actions can't easily read cookies from the client context automatically unless passed, but we can pass it or read it in the action. Let's let the action handle it or pass it.
    
    const metadata = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    };

    const res = await submitBugReport(userId, description, metadata);
    
    setIsSubmitting(false);
    if (res.success) {
      setStatusMsg('Report sent! Thank you.');
      setTimeout(() => {
        setIsOpen(false);
        setStatusMsg('');
        setDescription('');
      }, 2000);
    } else {
      setStatusMsg('Failed to send report. Please try again.');
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-50 p-3 rounded-full bg-red-600/80 text-white backdrop-blur-md border border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.5)] hover:bg-red-500 transition-all"
        title="Report a Bug"
      >
        <Bug size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative flex flex-col">
            <div className="p-4 bg-gray-800/50 flex justify-between items-center border-b border-white/5">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Bug className="text-red-500" /> 
                Report an Issue
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              <p className="text-sm text-gray-400">
                Please describe the problem you encountered. Your current page and browser info will be automatically attached.
              </p>
              
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What did you expect to happen?"
                className="w-full h-32 bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-red-500/50 resize-none"
                required
              />

              {statusMsg && (
                <div className={`text-sm ${statusMsg.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                  {statusMsg}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting || !description.trim()}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Submit Report'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
