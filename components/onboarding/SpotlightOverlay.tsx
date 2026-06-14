'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SpotlightOverlay — Premium Dark Glassmorphism Tutorial Engine
//
// How it works:
//   1. Looks up `targetId` element via document.getElementById
//   2. Reads its bounding rect (getBoundingClientRect)
//   3. Positions a "ring" div over that element using position:fixed
//   4. The ring has `spotlight-ring` class (globals.css) which uses
//      box-shadow to dim everything OUTSIDE the ring
//   5. Tooltip is positioned above or below the target based on available space
//
// Usage:
//   <SpotlightOverlay
//     targetId="tab-lineup"
//     title="Твой состав"
//     description="Здесь управляй командой!"
//     buttonLabel="Понял!"
//     onNext={handleNext}
//     onSkip={handleSkip}
//   />
// ─────────────────────────────────────────────────────────────────────────────

interface SpotlightProps {
  targetId: string;
  title: string;
  description: string;
  buttonLabel?: string;
  onNext: () => void;
  onSkip?: () => void;
  padding?: number;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function SpotlightOverlay({
  targetId,
  title,
  description,
  buttonLabel = 'Далее →',
  onNext,
  onSkip,
  padding = 8,
}: SpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipBelow, setTooltipBelow] = useState(true);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function measure() {
      const el = document.getElementById(targetId);
      if (!el) {
        rafRef.current = requestAnimationFrame(measure);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - padding,
        left: r.left - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      });
      setTooltipBelow(r.top < window.innerHeight * 0.6);
    }

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [targetId, padding]);

  if (!rect) return null;

  const TOOLTIP_GAP = 16;

  return (
    <AnimatePresence>
      {/* Full-screen overlay */}
      <motion.div
        key="spotlight-backdrop"
        className="fixed inset-0 z-[9999] pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Highlight ring */}
        <div
          className="absolute spotlight-ring neon-glow-pulse pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />

        {/* Click-through hole */}
        <div
          className="absolute pointer-events-auto cursor-pointer"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          onClick={onNext}
        />

        {/* Tooltip card — Premium Dark Glassmorphism */}
        <motion.div
          key="spotlight-tooltip"
          className="absolute mx-4 pointer-events-auto flex flex-col"
          style={{
            ...(tooltipBelow 
              ? { top: rect.top + rect.height + TOOLTIP_GAP }
              : { bottom: window.innerHeight - rect.top + TOOLTIP_GAP }),
            left: 16,
            right: 16,
          }}
          initial={{ opacity: 0, y: tooltipBelow ? -10 : 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: tooltipBelow ? -10 : 10 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          {/* Arrow pointing toward the target */}
          {tooltipBelow ? (
            <div className="w-0 h-0 ml-8 mb-[-1px]
              border-l-[8px] border-l-transparent
              border-r-[8px] border-r-transparent
              border-b-[8px] border-b-cyan-500/50" />
          ) : (
            <div className="w-0 h-0 ml-8 mt-[-1px] order-last
              border-l-[8px] border-l-transparent
              border-r-[8px] border-r-transparent
              border-t-[8px] border-t-cyan-500/50" />
          )}

          {/* Main tooltip — Glassmorphism */}
          <div className="relative rounded-2xl border border-cyan-500/30 backdrop-blur-2xl overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, rgba(15,15,30,0.95) 0%, rgba(8,8,20,0.98) 100%)',
                 boxShadow: '0 0 40px rgba(0,240,255,0.12), 0 20px 40px rgba(0,0,0,0.5)',
               }}>
            {/* Glass highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
            
            {/* Ambient glow */}
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-cyan-500/8 rounded-full blur-2xl pointer-events-none" />

            <div className="p-4 relative z-10">
              {/* Header with Assistant Avatar */}
              <div className="flex items-start gap-3 mb-2">
                {/* AI Scout Avatar */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full border border-cyan-400/50 bg-cyan-500/10 flex items-center justify-center"
                     style={{ boxShadow: '0 0 15px rgba(0,240,255,0.25)' }}>
                  <Bot size={16} className="text-cyan-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-orbitron font-bold text-white text-sm tracking-wide leading-tight"
                      style={{ textShadow: '0 0 10px rgba(0,240,255,0.3)' }}>
                    {title}
                  </h3>
                  <p className="text-[8px] text-cyan-400/50 uppercase tracking-widest font-bold mt-0.5">AI Scout</p>
                </div>

                {/* Skip button — Glass circle */}
                {onSkip && (
                  <button onClick={onSkip}
                          className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center
                                     text-gray-500 hover:text-white hover:bg-white/10 transition-all duration-300 active:scale-90 flex-shrink-0"
                          aria-label="Skip tutorial">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Description */}
              <p className="text-gray-300 text-xs leading-relaxed mb-3 ml-12">
                {description}
              </p>

              {/* Action Button — Glassmorphism Cyan */}
              <button onClick={onNext}
                      className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest
                                 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40
                                 hover:bg-cyan-500/30 hover:border-cyan-400/60
                                 active:scale-95 transition-all duration-300
                                 backdrop-blur-md"
                      style={{ boxShadow: '0 0 15px rgba(0,240,255,0.15)' }}>
                {buttonLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
