'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SpotlightOverlay — Tutorial highlight engine
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
  padding?: number; // extra px around the target element
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

  // Track target element position (handles layout shifts, scrolling, resizes)
  useEffect(() => {
    function measure() {
      const el = document.getElementById(targetId);
      if (!el) {
        rafRef.current = requestAnimationFrame(measure); // retry until found
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - padding,
        left: r.left - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      });
      // Place tooltip above if target is in the bottom 40% of screen
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
      {/* Full-screen overlay — blocks all interaction except the ring */}
      <motion.div
        key="spotlight-backdrop"
        className="fixed inset-0 z-[200] pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Highlight ring — positioned exactly over the target */}
        <div
          className="absolute spotlight-ring neon-glow-pulse pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />

        {/* Transparent "click-through" hole over the target so user can interact */}
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

        {/* Tooltip card */}
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
              border-b-[8px] border-b-cyan-500/60" />
          ) : (
            <div className="w-0 h-0 ml-8 mt-[-1px] order-last
              border-l-[8px] border-l-transparent
              border-r-[8px] border-r-transparent
              border-t-[8px] border-t-cyan-500/60" />
          )}

          <div className="bg-gray-950/95 backdrop-blur-xl border border-cyan-500/40
                          rounded-2xl p-4 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-orbitron font-bold text-white text-sm tracking-wide">
                {title}
              </h3>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="text-gray-500 hover:text-gray-300 transition-colors ml-2 mt-0.5"
                  aria-label="Skip tutorial"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-gray-300 text-xs leading-relaxed mb-4">
              {description}
            </p>
            <button
              onClick={onNext}
              className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest
                         text-black btn-shimmer active:scale-95 transition-transform
                         shadow-[0_0_15px_rgba(0,240,255,0.4)]"
            >
              {buttonLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
