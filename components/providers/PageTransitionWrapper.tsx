'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.28,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

export function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="flex flex-col flex-1 min-h-0"
        style={{ willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
