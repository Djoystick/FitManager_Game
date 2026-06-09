'use client';

import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode, useEffect, useState } from 'react';

export function TonProvider({ children }: { children: ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState('');

  useEffect(() => {
    // Dynamically fetch the origin to avoid CORS or 404 errors during local testing
    setManifestUrl(`${window.location.origin}/tonconnect-manifest.json`);
  }, []);

  if (!manifestUrl) {
    return null; // Wait for hydration
  }

  return (
    <TonConnectUIProvider 
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/FitManagerWeb3_bot/app'
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
