'use client';

import { useState } from 'react';
import { submitBugReport } from '@/app/actions/logActions';
import { Bug, X, Loader2, HelpCircle } from 'lucide-react';
import { usePageTour } from '@/components/providers/PageTourProvider';

export default function FloatingActionButtons() {
  const [isBugOpen, setIsBugOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  const { isActive, startTour } = usePageTour();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    const userId = null;
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
        setIsBugOpen(false);
        setStatusMsg('');
        setDescription('');
      }, 2000);
    } else {
      setStatusMsg('Failed to send report. Please try again.');
    }
  };

  // Only show the help button if the current page has registered tour steps
  // Actually, we can just dispatch an event to the page to start its tour,
  // or the page provides its steps to the provider. 
  // Wait, if the provider holds `steps`, but they are cleared when tour is closed?
  // No, `startTour` is what the page calls. If the page is active, how does the global button know the steps?
  // We need a way for the active page to register its tour steps with the provider.
  // Let's rely on a custom event, or add a `registeredSteps` to the Provider.

  const triggerTour = () => {
    window.dispatchEvent(new Event('startPageTour'));
  };

  return (
    <>
      <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3">
        {/* Help / Tutorial Button */}
        <button 
          onClick={triggerTour}
          className="p-2.5 rounded-full bg-cyan-600/80 text-white backdrop-blur-md border border-cyan-500/50 shadow-[0_0_15px_rgba(8,145,178,0.5)] hover:bg-cyan-500 transition-all active:scale-95"
          title="Page Tutorial"
        >
          <HelpCircle size={20} />
        </button>

        {/* Bug Report Button */}
        <button 
          onClick={() => setIsBugOpen(true)}
          className="p-2.5 rounded-full bg-red-600/80 text-white backdrop-blur-md border border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.5)] hover:bg-red-500 transition-all active:scale-95"
          title="Report a Bug"
        >
          <Bug size={20} />
        </button>
      </div>

      {isBugOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative flex flex-col">
            <div className="p-4 bg-gray-800/50 flex justify-between items-center border-b border-white/5">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Bug className="text-red-500" /> 
                Report an Issue
              </h2>
              <button onClick={() => setIsBugOpen(false)} className="text-gray-400 hover:text-white">
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
