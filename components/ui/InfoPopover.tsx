'use client';

import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  content: React.ReactNode;
  title?: string;
  className?: string;
}

export function InfoPopover({ content, title = 'Справка', className = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={`text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center ${className}`}
        aria-label="Info"
      >
        <HelpCircle size={14} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed z-[101] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <HelpCircle size={16} className="text-neon-cyan" />
                  {title}
                </h3>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }} 
                  className="text-gray-500 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="text-sm text-gray-300 leading-relaxed max-h-[60vh] overflow-y-auto">
                {content}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
