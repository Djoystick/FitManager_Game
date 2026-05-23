'use client';

import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ReactNode } from 'react';

export function TonProvider({ children }: { children: ReactNode }) {
  // Resolve the manifest URL, falling back to localhost for local testing environments
  const manifestUrl = process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/tonconnect-manifest.json`
    : 'http://localhost:3000/tonconnect-manifest.json'; 

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}
