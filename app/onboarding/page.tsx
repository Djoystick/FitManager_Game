'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStarterFranchise } from '@/app/actions/teamActions';

export default function OnboardingPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setIsCreating(true);
    setErrorMsg(null);

    const res = await createStarterFranchise(teamName.trim());
    
    if (res.success) {
      // Small delay for the user to see the success state
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 500);
    } else {
      setErrorMsg(res.error || 'Failed to create franchise.');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-[#0B0F19] items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-20%] w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neon-cyan/5 via-[#0B0F19]/80 to-[#0B0F19] pointer-events-none" />
      <div className="absolute w-64 h-64 bg-neon-cyan/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Content Container */}
      <div className="w-full max-w-sm z-10 flex flex-col items-center">
        
        {/* Logo / Icon */}
        <div className="w-24 h-24 rounded-full border border-neon-cyan/40 mb-6 flex items-center justify-center bg-black/60 shadow-[0_0_30px_rgba(0,240,255,0.2)] backdrop-blur-md relative overflow-hidden group">
          <div className="absolute inset-0 bg-neon-cyan/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <span className="text-4xl text-neon-cyan font-orbitron font-black tracking-tighter drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]">
            FM
          </span>
        </div>

        {/* Text */}
        <h1 className="text-3xl font-black text-white mb-2 text-center tracking-wide font-orbitron drop-shadow-md">
          Welcome, Manager.
        </h1>
        <p className="text-gray-400 text-center mb-10 text-sm leading-relaxed px-4 font-inter">
          Create your franchise to enter the league. You will receive a starter pack of <span className="text-neon-cyan font-bold">16 players</span>, <span className="text-yellow-400 font-bold">1000 FC</span> and <span className="text-neon-cyan font-bold">1000 SP</span>.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
          <div className="relative group">
            <label className="absolute -top-3 left-4 bg-[#0B0F19] px-2 text-[10px] text-neon-cyan uppercase tracking-widest font-bold z-10">
              Franchise Name
            </label>
            <input 
              type="text" 
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Cyber City FC"
              required
              maxLength={25}
              className="w-full bg-black/40 border border-gray-800 text-white font-bold rounded-xl p-4 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all duration-300 placeholder:text-gray-600 shadow-inner"
            />
          </div>
          
          {errorMsg && (
            <div className="text-red-400 text-xs text-center font-bold bg-red-900/20 border border-red-500/30 p-3 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              {errorMsg}
            </div>
          )}
          
          <button 
            type="submit"
            disabled={isCreating || !teamName.trim()}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest transition-all duration-300 font-orbitron relative overflow-hidden ${
              isCreating || !teamName.trim()
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                : 'bg-neon-cyan text-black hover:bg-white hover:text-neon-cyan hover:shadow-[0_0_25px_rgba(0,240,255,0.6)] shadow-[0_0_15px_rgba(0,240,255,0.4)] border border-neon-cyan/50'
            }`}
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                Drafting...
              </span>
            ) : (
              'Create Franchise'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
