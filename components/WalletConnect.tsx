'use client';

import { useEffect, useContext, useRef } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { TelegramAuthContext } from './TelegramAuthProvider';

export function WalletConnect() {
  const wallet = useTonWallet();
  const { userId, isAuthenticated } = useContext(TelegramAuthContext);
  const isSyncing = useRef(false);

  useEffect(() => {
    // Attempt to sync only if we have an authenticated user and a connected wallet
    if (wallet && isAuthenticated && userId && !isSyncing.current) {
      const syncWallet = async () => {
        isSyncing.current = true;
        try {
          // Extract the raw wallet address from the connected account
          const walletAddress = wallet.account.address;
          
          const response = await fetch('/api/user/wallet', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              walletAddress,
            }),
          });

          if (!response.ok) {
            console.error('Failed to sync wallet address to database');
          } else {
            console.log('Wallet synced securely to the backend.');
          }
        } catch (error) {
          console.error('Error executing wallet sync:', error);
        } finally {
          isSyncing.current = false;
        }
      };

      syncWallet();
    }
  }, [wallet, userId, isAuthenticated]);

  return (
    <div className="flex flex-col items-center gap-4">
      <TonConnectButton />
      {wallet && (
        <span className="text-sm font-semibold tracking-wide text-neon-green">
          Wallet Linked
        </span>
      )}
    </div>
  );
}
