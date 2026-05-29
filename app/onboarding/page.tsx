'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStarterFranchise } from '@/app/actions/teamActions';

export default function OnboardingPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

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
        <h1 className="text-3xl font-black text-white mb-2 text-center tracking-wide font-orbitron drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
          Welcome, Manager.
        </h1>
        <div className="bg-black/50 backdrop-blur-md border border-neon-cyan/20 p-4 rounded-xl shadow-[0_0_15px_rgba(0,240,255,0.1)] mb-8">
          <p className="text-gray-300 text-center text-sm leading-relaxed font-inter">
            Добро пожаловать в FitManager — Web3 симулятор футбольного менеджера нового поколения. Ваша реальная физическая активность конвертируется в Sweat Points. Тренируйте кибер-атлетов, торгуйте на глобальном рынке за TON и покорите Высшую Лигу.
          </p>
        </div>

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
              className="w-full bg-black/60 border border-gray-800/80 text-white font-bold rounded-xl p-4 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all duration-300 placeholder:text-gray-600 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] hover:border-neon-cyan/50"
            />
          </div>
          
          {errorMsg && (
            <div className="text-red-400 text-xs text-center font-bold bg-red-900/20 border border-red-500/30 p-3 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              {errorMsg}
            </div>
          )}
          
          <div className="flex items-start gap-3 px-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-600 text-neon-cyan focus:ring-neon-cyan focus:ring-offset-0 bg-black/60 cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-gray-400 leading-tight">
              I have read and agree to the{' '}
              <a href="/terms" target="_blank" className="text-neon-cyan hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" className="text-neon-cyan hover:underline">Privacy Policy</a>.
            </label>
          </div>

          <button 
            type="submit"
            disabled={isCreating || !teamName.trim() || !agreedToTerms}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest transition-all duration-300 font-orbitron relative overflow-hidden ${
              isCreating || !teamName.trim() || !agreedToTerms
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
