'use client';

import { useContext, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import { motion, AnimatePresence } from 'framer-motion';

export function AchievementToastProvider() {
  const { userId } = useContext(TelegramAuthContext);

  useEffect(() => {
    if (!userId) return;

    let intervalId: NodeJS.Timeout;

    const checkNotifications = async () => {
      try {
        const res = await fetch(`/api/notifications?userId=${userId}`);
        if (!res.ok) return;
        const notifications: any[] = await res.json();

        if (notifications.length > 0) {
          // Filter achievements
          const achievements = notifications.filter(n => n.type === 'ACHIEVEMENT_UNLOCKED');

          // Show toasts
          achievements.forEach(ach => {
            const payload = ach.payload;
            toast.custom(
              (t) => (
                <AnimatePresence>
                  {t.visible && (
                    <motion.div
                      initial={{ opacity: 0, y: 50, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                      className="pointer-events-auto flex items-center bg-black/90 border border-neon-cyan/50 shadow-[0_0_30px_rgba(0,255,255,0.2)] rounded-2xl p-4 gap-4 w-full max-w-sm backdrop-blur-xl relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/10 to-transparent pointer-events-none" />
                      
                      <div className="text-4xl relative z-10 flex-shrink-0 animate-bounce">
                        {payload.icon}
                      </div>
                      
                      <div className="flex-1 relative z-10">
                        <div className="text-[10px] text-neon-cyan uppercase font-bold tracking-widest mb-0.5">
                          Ачивка открыта!
                        </div>
                        <h4 className="text-white font-black uppercase text-sm tracking-wide">
                          {payload.name}
                        </h4>
                        
                        {(payload.rewardFC > 0 || payload.rewardTON > 0) && (
                          <div className="flex gap-2 mt-2">
                            {payload.rewardFC > 0 && (
                              <span className="text-xs font-mono font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                                +{payload.rewardFC.toLocaleString()} FC
                              </span>
                            )}
                            {payload.rewardTON > 0 && (
                              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                                +{payload.rewardTON} TON
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              ),
              { duration: 5000, position: 'bottom-center' }
            );
          });

          // Mark all as read
          const ids = notifications.map(n => n.id);
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationIds: ids })
          });
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };

    // Initial check
    checkNotifications();

    // Check every 30 seconds
    intervalId = setInterval(checkNotifications, 30000);

    return () => clearInterval(intervalId);
  }, [userId]);

  return null;
}
