'use client';

import { useEffect, useContext, useRef, useState, useCallback } from 'react';
import { TonConnectButton, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { TelegramAuthContext } from '@/components/providers/TelegramAuthProvider';
import toast from 'react-hot-toast';

export function WalletConnect({ onSyncSuccess }: { onSyncSuccess?: () => void }) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const { isAuthenticated } = useContext(TelegramAuthContext);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Track if we successfully verified for the current connected wallet
  const verifiedAddress = useRef<string | null>(null);

  // 1. Fetch Payload and setup TonConnectUI
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchPayload = async () => {
      tonConnectUI.setConnectRequestParameters({ state: 'loading' });
      try {
        const res = await fetch('/api/user/wallet/payload', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to fetch payload');
        
        const data = await res.json();
        if (data.payload) {
          tonConnectUI.setConnectRequestParameters({
            state: 'ready',
            value: { tonProof: data.payload }
          });
        } else {
          tonConnectUI.setConnectRequestParameters({ state: 'ready', value: null as any });
        }
      } catch (err) {
        console.error("Payload fetch error", err);
        // Fallback to ready without proof if server is down, though it will fail verification later.
        tonConnectUI.setConnectRequestParameters({ state: 'ready', value: null as any });
      }
    };

    fetchPayload();
  }, [isAuthenticated, tonConnectUI]);

  // 2. Handle Connection and Verification
  const verifyWallet = useCallback(async (currentWallet: any) => {
    if (!currentWallet || !currentWallet.account || verifiedAddress.current === currentWallet.account.address) {
      return;
    }

    // Check if the wallet provided a proof
    if (!currentWallet.connectItems?.tonProof || !('proof' in currentWallet.connectItems.tonProof)) {
      toast.error('Security verification failed: No signature provided.');
      await tonConnectUI.disconnect();
      return;
    }

    const proof = currentWallet.connectItems.tonProof.proof;

    setIsVerifying(true);
    const loadingToast = toast.loading('Verifying secure connection...');

    try {
      const res = await fetch('/api/user/wallet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: currentWallet.account,
          proof: proof
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      verifiedAddress.current = currentWallet.account.address;
      toast.success('Wallet securely linked!', { id: loadingToast });
      
      if (onSyncSuccess) {
        onSyncSuccess();
      }

    } catch (err: any) {
      console.error('Wallet Verification Error:', err);
      toast.error(err.message || 'Verification failed', { id: loadingToast });
      verifiedAddress.current = null;
      await tonConnectUI.disconnect(); // Disconnect if verification fails
    } finally {
      setIsVerifying(false);
    }
  }, [tonConnectUI, onSyncSuccess]);

  // Trigger verification when wallet changes
  useEffect(() => {
    if (wallet && isAuthenticated && !isVerifying) {
      verifyWallet(wallet);
    }
  }, [wallet, isAuthenticated, verifyWallet, isVerifying]);

  return (
    <div className="flex flex-col items-center gap-2">
      <TonConnectButton />
      {wallet && verifiedAddress.current === wallet.account.address && (
        <span className="text-[10px] font-bold tracking-widest uppercase text-neon-green/80 flex items-center gap-1 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
          Securely Linked
        </span>
      )}
      {isVerifying && (
        <span className="text-[10px] font-bold tracking-widest uppercase text-yellow-500/80 mt-1">
          Verifying signature...
        </span>
      )}
    </div>
  );
}
