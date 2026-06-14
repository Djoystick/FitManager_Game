'use client';

import React, { useState, useTransition } from 'react';
import { Wallet, Download, Upload, QrCode, X } from 'lucide-react';
import { debugAddTonAction } from '@/app/actions/marketActions';
import toast from 'react-hot-toast';
import { dict } from '@/lib/dictionaries';

interface MarketWalletProps {
  balance: number;
  userId: string;
  language: string;
  onBalanceUpdate: () => void;
}

export function MarketWallet({ balance, userId, language, onBalanceUpdate }: MarketWalletProps) {
  const t = dict[language as keyof typeof dict];
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleDebugAddTon = () => {
    startTransition(async () => {
      const res = await debugAddTonAction(5);
      if (res.success) {
        toast.success('+5 TON (Debug) Added');
        onBalanceUpdate();
        window.dispatchEvent(new Event('balanceUpdated'));
      } else {
        toast.error(res.error || 'Failed to add TON');
      }
    });
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAddress || !withdrawAmount) return;
    toast.success('Withdrawal request sent (Mock)');
    setIsWithdrawOpen(false);
    setWithdrawAddress('');
    setWithdrawAmount('');
  };

  return (
    <>
      {/* Main Wallet Card — Premium Glassmorphism */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/25 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl"
           style={{
             background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(255,255,255,0.03) 50%, rgba(6,182,212,0.06) 100%)',
             boxShadow: '0 0 30px rgba(59,130,246,0.08)',
           }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-blue-500/8 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center backdrop-blur-md"
               style={{ boxShadow: '0 0 15px rgba(59,130,246,0.2)' }}>
            <Wallet size={20} className="text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">TON Balance</span>
            <div className="flex items-center gap-1.5">
              <span className="text-blue-400 text-sm" style={{ textShadow: '0 0 8px rgba(96,165,250,0.6)' }}>💎</span>
              <span className="text-xl font-black font-orbitron text-white" style={{ textShadow: '0 0 10px rgba(59,130,246,0.3)' }}>{balance.toFixed(2)}</span>
              <span className="text-xs text-blue-400/60 font-bold">TON</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto relative z-10">
          <button onClick={() => setIsDepositOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all duration-300 active:scale-95 border backdrop-blur-md"
                  style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(6,182,212,0.2) 100%)', borderColor: 'rgba(59,130,246,0.4)', color: '#93c5fd', boxShadow: '0 0 15px rgba(59,130,246,0.2)' }}>
            <Download size={14} /> Deposit
          </button>
          <button onClick={() => setIsWithdrawOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-gray-300 font-bold uppercase tracking-widest text-[10px] transition-all duration-300 active:scale-95 border border-white/10 hover:bg-white/8 backdrop-blur-md">
            <Upload size={14} /> Withdraw
          </button>
        </div>
      </div>

      {/* Deposit Modal — Glassmorphism */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="relative w-full max-w-sm rounded-2xl border border-blue-500/30 overflow-hidden"
               style={{ background: 'linear-gradient(135deg, rgba(15,15,30,0.98) 0%, rgba(8,8,20,1) 100%)', boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 30px rgba(59,130,246,0.1)' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
            
            <button onClick={() => setIsDepositOpen(false)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-90 z-10">
              <X size={12} />
            </button>

            <div className="p-5">
              <h2 className="text-lg font-black uppercase tracking-wider mb-1 text-white text-center font-orbitron">Deposit TON</h2>
              <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest mb-5">
                Send TON to the Master Wallet. Include your User ID as Memo!
              </p>
              
              <div className="bg-white p-2 rounded-xl mb-4 flex justify-center">
                <QrCode size={100} className="text-black" />
              </div>
              
              <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-2 flex flex-col gap-1 text-center backdrop-blur-md">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Master Wallet</span>
                <span className="text-xs font-mono text-cyan-300 break-all">EQC_MasterWalletAddress123...</span>
              </div>
              
              <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-5 flex flex-col gap-1 text-center backdrop-blur-md">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Memo (Required)</span>
                <span className="text-sm font-mono text-amber-300 break-all">{userId}</span>
              </div>
              
              <button onClick={handleDebugAddTon} disabled={isPending}
                      className="w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 active:scale-95 border backdrop-blur-md"
                      style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(6,182,212,0.15) 100%)', borderColor: 'rgba(59,130,246,0.4)', color: '#93c5fd', boxShadow: '0 0 15px rgba(59,130,246,0.15)' }}>
                {isPending ? 'Processing...' : 'Debug: +5 TON'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal — Glassmorphism */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 overflow-hidden"
               style={{ background: 'linear-gradient(135deg, rgba(15,15,30,0.98) 0%, rgba(8,8,20,1) 100%)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <button onClick={() => setIsWithdrawOpen(false)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-90 z-10">
              <X size={12} />
            </button>

            <div className="p-5">
              <h2 className="text-lg font-black uppercase tracking-wider mb-1 text-white font-orbitron">Withdraw TON</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-5">Transfer TON to your external wallet</p>
              
              <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">TON Wallet Address</label>
                  <input type="text" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)}
                         placeholder="EQC..." required
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-400/50 outline-none font-mono transition-all duration-300" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Amount (TON)</label>
                  <input type="number" step="0.1" min="0.1" max={balance} value={withdrawAmount}
                         onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0.0" required
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-400/50 outline-none font-orbitron transition-all duration-300" />
                </div>
                <button type="submit"
                        className="w-full py-3 mt-1 rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 active:scale-95 border backdrop-blur-md"
                        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(6,182,212,0.2) 100%)', borderColor: 'rgba(59,130,246,0.4)', color: '#93c5fd', boxShadow: '0 0 15px rgba(59,130,246,0.2)' }}>
                  Withdraw
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
