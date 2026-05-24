'use client';

import { useState, useContext } from 'react';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

interface OnboardingFlowProps {
  userId: string;
  onComplete: () => void;
}

export function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const headerFontClass = language === 'ru' ? 'font-russo' : 'font-orbitron';
  const buttonFontClass = language === 'ru' ? 'font-russo' : 'font-orbitron';

  const [teamNameInput, setTeamNameInput] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !teamNameInput.trim()) return;
    
    setIsCreatingTeam(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/team/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, teamName: teamNameInput.trim() }),
      });
      
      if (res.ok) {
        onComplete();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to create team');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Network error');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  if (step === 1) {
    return (
      <div className="flex flex-col flex-1 p-6 gap-8 justify-center min-h-screen bg-space-dark items-center text-center">
        <div className="w-24 h-24 rounded-full border-4 border-neon-cyan mb-4 flex items-center justify-center bg-black/50 shadow-[0_0_30px_rgba(0,240,255,0.4)]">
          <span className={`text-4xl text-neon-cyan ${headerFontClass}`}>FM</span>
        </div>
        <h1 className={`text-3xl font-bold text-white mb-2 tracking-wide ${headerFontClass}`}>
          {t.welcome}
        </h1>
        <p className="text-gray-300 leading-relaxed mb-8 text-base px-2">
          {t.onboarding_welcome}
        </p>
        <button 
          onClick={() => setStep(2)}
          className={`w-full max-w-xs py-4 rounded-lg font-bold text-black uppercase tracking-wider transition-all duration-300 bg-neon-cyan hover:bg-white hover:text-neon-cyan shadow-[0_0_20px_rgba(0,240,255,0.6)] ${buttonFontClass}`}
        >
          {t.onboarding_next}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-6 gap-8 justify-center min-h-screen bg-space-dark">
      <div className="bg-black/60 backdrop-blur-md p-8 rounded-2xl border border-neon-pink/50 shadow-[0_0_30px_rgba(255,0,60,0.2)]">
        <h1 className={`text-2xl font-bold text-white mb-2 text-center uppercase ${headerFontClass}`}>{t.onboarding_create_title}</h1>
        <p className="text-gray-400 text-center mb-8 text-sm">{t.onboarding_create_desc}</p>
        
        <form onSubmit={handleCreateTeam} className="flex flex-col gap-5">
          <div>
            <label className="text-xs text-neon-cyan uppercase tracking-widest font-bold mb-2 block">{t.onboarding_franchise_name}</label>
            <input 
              type="text" 
              value={teamNameInput}
              onChange={(e) => setTeamNameInput(e.target.value)}
              placeholder={t.onboarding_placeholder}
              required
              maxLength={30}
              className="w-full bg-black/50 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all"
            />
          </div>
          
          {errorMsg && (
            <div className="text-red-400 text-xs text-center font-bold bg-red-900/30 p-2 rounded">
              {errorMsg}
            </div>
          )}
          
          <button 
            type="submit"
            disabled={isCreatingTeam || !teamNameInput.trim()}
            className={`w-full py-4 rounded-lg font-bold text-black uppercase tracking-wider transition-all duration-300 mt-2 ${buttonFontClass} ${
              isCreatingTeam || !teamNameInput.trim()
                ? 'bg-gray-600 cursor-not-allowed opacity-70'
                : 'bg-neon-pink hover:bg-white hover:text-neon-pink hover:shadow-[0_0_20px_rgba(255,0,60,0.6)] shadow-[0_0_10px_rgba(255,0,60,0.4)]'
            }`}
          >
            {isCreatingTeam ? t.onboarding_drafting : t.onboarding_submit}
          </button>
        </form>
      </div>
    </div>
  );
}
