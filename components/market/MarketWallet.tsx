'use client';

import React, { useState, useTransition } from 'react';
import { Wallet, Download, Upload, QrCode } from 'lucide-react';
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
      <div className="bg-black/60 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-900/30 border border-blue-500/50 flex items-center justify-center text-blue-400">
            <Wallet size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">TON Balance</span>
            <div className="flex items-center gap-1.5">
              <span className="text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] text-sm">💎</span> 
              <span className="text-xl font-black font-orbitron text-white">{balance.toFixed(2)}</span>
              <span className="text-xs text-blue-500 font-bold">TON</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setIsDepositOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] transition-colors shadow-[0_0_10px_rgba(37,99,235,0.4)]"
          >
            <Download size={14} /> Deposit
          </button>
          <button 
            onClick={() => setIsWithdrawOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold uppercase tracking-widest text-[10px] transition-colors border border-gray-700"
          >
            <Upload size={14} /> Withdraw
          </button>
        </div>
      </div>

      {/* Deposit Modal */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm flex flex-col items-center relative">
            <button 
              onClick={() => setIsDepositOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-lg font-black uppercase tracking-wider mb-2 text-white text-center">Deposit TON</h2>
            <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest mb-6">
              Send TON to the Master Wallet. <br/>You MUST include your User ID as Memo!
            </p>
            
            <div className="bg-white p-2 rounded-lg mb-4">
              <QrCode size={120} className="text-black" />
            </div>
            
            <div className="w-full bg-black/50 border border-gray-800 rounded p-3 mb-2 flex flex-col gap-1 text-center">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Master Wallet</span>
              <span className="text-xs font-mono text-neon-cyan break-all">EQC_MasterWalletAddress123...</span>
            </div>
            
            <div className="w-full bg-black/50 border border-gray-800 rounded p-3 mb-6 flex flex-col gap-1 text-center">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Memo (Required)</span>
              <span className="text-sm font-mono text-yellow-400 break-all">{userId}</span>
            </div>
            
            <button 
              onClick={handleDebugAddTon}
              disabled={isPending}
              className="w-full py-3 bg-neon-cyan/10 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-black rounded font-black uppercase tracking-widest text-xs transition-colors"
            >
              {isPending ? 'Processing...' : 'Debug: +5 TON'}
            </button>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm flex flex-col relative">
            <button 
              onClick={() => setIsWithdrawOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-lg font-black uppercase tracking-wider mb-2 text-white">Withdraw TON</h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-6">
              Transfer TON to your external wallet
            </p>
            
            <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">TON Wallet Address</label>
                <input 
                  type="text" 
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="EQC..."
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-neon-cyan outline-none font-mono"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Amount (TON)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0.1"
                  max={balance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-neon-cyan outline-none font-orbitron"
                  required
                />
              </div>
              
              <button 
                type="submit"
                className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-black uppercase tracking-widest text-xs transition-colors shadow-[0_0_10px_rgba(37,99,235,0.4)]"
              >
                Withdraw
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
