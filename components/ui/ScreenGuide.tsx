'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle } from 'lucide-react';

interface ScreenGuideProps {
  screenName: string;
  title: string;
  content: string;
}

export function ScreenGuide({ screenName, title, content }: ScreenGuideProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const storageKey = `fitmanager_guide_${screenName}`;

  useEffect(() => {
    setHasMounted(true);
    setIsVisible(false); // Reset visibility on key/screen change
    const hasSeen = localStorage.getItem(storageKey);
    if (!hasSeen) {
      // Slight delay so the user sees the page first
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem(storageKey, 'true');
  };

  const handleOpen = () => {
    setIsVisible(true);
  };

  if (!hasMounted) return null;

  return (
    <>
      {/* Trigger Button */}
      <button 
        onClick={handleOpen}
        className="fixed bottom-24 right-4 z-[90] w-10 h-10 bg-black/80 backdrop-blur-md border border-neon-cyan/40 rounded-full flex items-center justify-center text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.5)] transition-all duration-300"
        aria-label="Screen Guide"
      >
        <HelpCircle size={20} />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-gray-900/90 border border-neon-cyan/50 p-6 rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.15)] relative overflow-hidden"
            >
              {/* Decorative top line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-cyan to-transparent"></div>
              
              <h3 className="text-xl font-orbitron font-bold text-white mb-3 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]"></span>
                {title}
              </h3>
              
              <p className="text-gray-300 text-sm leading-relaxed mb-6 font-inter">
                {content}
              </p>
              
              <button
                onClick={handleClose}
                className="w-full py-3 bg-neon-cyan text-black font-orbitron font-bold text-sm tracking-wider rounded-xl hover:bg-white hover:text-neon-cyan transition-all duration-300 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
              >
                Understood
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
