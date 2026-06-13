'use client';

import { useState, useEffect } from 'react';
import { Wrench, ShieldAlert, CheckCircle, Clock, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMaintenanceInfo, payMaintenance, type MaintenanceInfo } from '@/app/actions/trainingActions';
import toast from 'react-hot-toast';

interface InfrastructureReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaid: () => void;
  onDeferred: () => void;
}

const BUILDING_ICONS: Record<string, string> = {
  stadium: '🏟️',
  medical: '🏥',
  academy: '🎓',
  scout: '🔍',
  seating: '💺',
  services: '☕',
};

export function InfrastructureReportModal({
  isOpen,
  onClose,
  onPaid,
  onDeferred,
}: InfrastructureReportModalProps) {
  const [info, setInfo] = useState<MaintenanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [step, setStep] = useState<'idle' | 'paying' | 'done'>('idle');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getMaintenanceInfo().then(res => {
        if (res.success && res.data) setInfo(res.data);
        setLoading(false);
      });
    }
  }, [isOpen]);

  const handlePay = async () => {
    setPaying(true);
    setStep('paying');
    const res = await payMaintenance();
    if (res.success) {
      setStep('done');
      toast.success('Ремонт проведён! Инфраструктура восстановлена.', { icon: '🔧' });
      setTimeout(() => {
        onPaid();
        onClose();
      }, 1200);
    } else {
      toast.error(res.error ?? 'Ошибка оплаты');
      setStep('idle');
    }
    setPaying(false);
  };

  const handleDefer = () => {
    // Store deferred state in localStorage with timestamp
    const now = Date.now();
    localStorage.setItem('fm_maintenance_deferred_at', String(now));
    toast('Ремонт отложен. -20% к доходу от билетов в этом сезоне.', { icon: '⚠️', duration: 5000 });
    onDeferred();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm bg-gray-900 border-2 border-amber-500/40 rounded-2xl shadow-[0_0_60px_rgba(245,158,11,0.15)] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-b from-amber-500/15 to-transparent p-5 text-center border-b border-amber-500/20">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Wrench className="text-amber-400" size={24} />
            </div>
            <div className="mt-6">
              <h2 className="text-sm font-black font-orbitron text-amber-400 uppercase tracking-widest">
                Отчёт по Инфраструктуре
              </h2>
              <p className="text-[10px] text-gray-500 mt-1">Ежесезонный аудит состояния объектов</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            ) : step === 'done' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8 gap-3"
              >
                <CheckCircle className="text-emerald-400" size={48} />
                <p className="text-sm font-bold text-emerald-400">Ремонт завершён!</p>
                <p className="text-[10px] text-gray-500">Инфраструктура восстановлена до 100%</p>
              </motion.div>
            ) : info ? (
              <>
                {/* Overall Wear */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Общий износ</span>
                    <span className={`text-sm font-black font-orbitron ${info.overallWearPct > 70 ? 'text-red-400' : info.overallWearPct > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {info.overallWearPct}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-black/60 rounded-full overflow-hidden border border-gray-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${info.overallWearPct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full rounded-full ${info.overallWearPct > 70 ? 'bg-gradient-to-r from-red-500 to-red-400' : info.overallWearPct > 40 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
                      style={{ boxShadow: `0 0 8px ${info.overallWearPct > 70 ? 'rgba(239,68,68,0.5)' : info.overallWearPct > 40 ? 'rgba(245,158,11,0.5)' : 'rgba(16,185,129,0.5)'}` }}
                    />
                  </div>
                </div>

                {/* Building List */}
                <div className="space-y-2 mb-4">
                  {info.buildings.map((b, idx) => (
                    <motion.div
                      key={b.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-black/40 border border-gray-800/50"
                    >
                      <span className="text-lg">{BUILDING_ICONS[b.key] || '🏗️'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-300">{b.label}</span>
                          <span className="text-[9px] font-mono text-gray-500">Ур. {b.level}</span>
                        </div>
                        <div className="h-1.5 bg-black/60 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full bg-amber-400/80 transition-all duration-500"
                            style={{ width: `${b.wearPct}%` }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Cost Summary */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="text-amber-400" size={14} />
                    <span className="text-[11px] font-bold text-amber-300">Стоимость ремонта</span>
                  </div>
                  <span className="text-sm font-black font-orbitron text-amber-400">
                    {info.totalRepairCost.toLocaleString()} FC
                  </span>
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleDefer}
                    disabled={paying}
                    className="flex-1 py-2.5 rounded-xl text-[10px] font-black font-orbitron uppercase tracking-wider
                               bg-gray-800/60 text-gray-400 border border-gray-700/40
                               hover:bg-gray-700/60 hover:text-gray-300 transition-all duration-200
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Clock size={12} />
                      Отложить
                    </div>
                  </button>
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="flex-1 py-2.5 rounded-xl text-[10px] font-black font-orbitron uppercase tracking-wider
                               bg-gradient-to-r from-amber-500 to-orange-500 text-black
                               hover:from-amber-400 hover:to-orange-400 transition-all duration-200
                               shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)]
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {paying ? (
                        <span className="animate-spin">⚙️</span>
                      ) : (
                        <Wrench size={12} />
                      )}
                      Провести ремонт
                    </div>
                  </button>
                </div>

                {/* Defer Warning */}
                <div className="flex items-start gap-1.5 mt-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                  <ShieldAlert className="text-red-400/60 flex-shrink-0 mt-0.5" size={10} />
                  <p className="text-[8px] text-red-400/60 leading-relaxed">
                    При отложке: -20% к доходу от билетов на весь следующий сезон
                  </p>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 text-xs py-8">Ошибка загрузки данных</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
