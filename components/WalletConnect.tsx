'use client';

import { useEffect, useContext, useRef, useState, useCallback } from 'react';
import { TonConnectButton, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import toast from 'react-hot-toast';
import { LanguageContext } from '@/components/LanguageContext';
import { dict } from '@/lib/dictionaries';
import { Unlink } from 'lucide-react';

export function WalletConnect({ onSyncSuccess }: { onSyncSuccess?: () => void }) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const { isAuthenticated } = useContext(TelegramAuthContext);
  const { language } = useContext(LanguageContext);
  const t = dict[language as keyof typeof dict];
  const [isVerifying, setIsVerifying] = useState(false);
  const verifiedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchPayload = async () => {
      tonConnectUI.setConnectRequestParameters({ state: 'loading' });
      try {
        const res = await fetch('/api/user/wallet/payload', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to fetch payload');
        const data = await res.json();
        if (data.payload) {
          tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: data.payload } });
        } else {
          tonConnectUI.setConnectRequestParameters(null);
        }
      } catch (err) {
        console.error("Payload fetch error", err);
        tonConnectUI.setConnectRequestParameters(null);
      }
    };
    fetchPayload();
  }, [isAuthenticated, tonConnectUI]);

  const verifyWallet = useCallback(async (currentWallet: any) => {
    if (!currentWallet || !currentWallet.account || verifiedAddress.current === currentWallet.account.address) return;

    if (!currentWallet.connectItems?.tonProof || !('proof' in currentWallet.connectItems.tonProof)) {
      toast.error(t.wallet_sec_failed || 'Security verification failed: No signature provided.');
      await tonConnectUI.disconnect();
      return;
    }

    const proof = currentWallet.connectItems.tonProof.proof;
    setIsVerifying(true);
    const loadingToast = toast.loading(t.wallet_verifying || 'Verifying secure connection...');

    try {
      const res = await fetch('/api/user/wallet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: currentWallet.account, proof: proof })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.wallet_verify_failed || 'Verification failed');
      verifiedAddress.current = currentWallet.account.address;
      toast.success(t.wallet_linked || 'Wallet securely linked!', { id: loadingToast });
      if (onSyncSuccess) onSyncSuccess();
    } catch (err: any) {
      console.error('Wallet Verification Error:', err);
      toast.error(err.message || t.wallet_verify_failed || 'Verification failed', { id: loadingToast });
      verifiedAddress.current = null;
      await tonConnectUI.disconnect();
    } finally {
      setIsVerifying(false);
    }
  }, [tonConnectUI, onSyncSuccess, t]);

  useEffect(() => {
    if (wallet && isAuthenticated && !isVerifying) verifyWallet(wallet);
  }, [wallet, isAuthenticated, verifyWallet, isVerifying]);

  const handleDisconnect = async () => {
    if (confirm(t.wallet_disconnect_confirm || 'Are you sure you want to disconnect your wallet?')) {
      await tonConnectUI.disconnect();
      verifiedAddress.current = null;
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <TonConnectButton />
      {wallet && verifiedAddress.current === wallet.account.address && (
        <div className="flex flex-col items-center gap-2 mt-1">
          <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-300 flex items-center gap-1.5"
                style={{ textShadow: '0 0 8px rgba(52,211,153,0.4)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.8)' }} />
            {t.wallet_linked || 'Securely Linked'}
          </span>
          <button onClick={handleDisconnect}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-[9px] uppercase tracking-widest font-bold transition-all duration-300 active:scale-95 backdrop-blur-md">
            <Unlink size={10} />
            {t.wallet_disconnect_btn || 'Disconnect Wallet'}
          </button>
        </div>
      )}
      {isVerifying && (
        <span className="text-[10px] font-bold tracking-widest uppercase text-amber-300/80 mt-1"
              style={{ textShadow: '0 0 8px rgba(245,158,11,0.4)' }}>
          {t.wallet_verifying || 'Verifying signature...'}
        </span>
      )}
    </div>
  );
}
