'use client';

import { useState, useEffect, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';

export function TooltipTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('fitmanager_tour_completed_v2');
    if (!hasSeenTour) {
      const timer = setTimeout(() => setIsVisible(true), 1500); // slight delay after load
      return () => clearTimeout(timer);
    }
  }, []);

  const steps = [
    {
      title: t.tour_welcome,
      content: t.tour_welcome_desc,
      position: 'bottom-20 left-4 right-4 mx-auto', 
    },
    {
      title: t.tour_steps,
      content: t.tour_steps_desc,
      position: 'top-24 left-4 right-4 mx-auto', 
    },
    {
      title: t.tour_match,
      content: t.tour_match_desc,
      position: 'bottom-24 left-4 right-4 mx-auto', 
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const completeTour = () => {
    setIsVisible(false);
    localStorage.setItem('fitmanager_tour_completed_v2', 'true');
  };
  if (pathname === '/onboarding') return null;
  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
      >
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <motion.div 
            key={currentStep}
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20 }}
            className={`absolute ${steps[currentStep].position} pointer-events-auto w-[90%] max-w-[340px]`}
          >
            <div className="bg-gray-900 border border-neon-cyan/50 p-5 rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.2)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-cyan to-transparent"></div>
              
              <h3 className="text-neon-cyan font-orbitron font-bold text-lg mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse"></span>
                {steps[currentStep].title}
              </h3>
              
              <p className="text-sm text-gray-300 font-sans leading-relaxed mb-4">
                {steps[currentStep].content}
              </p>
              
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-1.5">
                  {steps.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-5 bg-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.8)]' : 'w-2 bg-gray-700'}`}
                    />
                  ))}
                </div>
                
                <button
                  onClick={handleNext}
                  className="px-4 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan font-orbitron text-xs rounded transition-colors active:scale-95"
                >
                  {currentStep === steps.length - 1 ? t.tour_start : t.tour_next}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
