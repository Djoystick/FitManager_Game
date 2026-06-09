import type { Metadata, Viewport } from "next";
import { Inter, Orbitron, Russo_One, Space_Grotesk } from "next/font/google";
import { PageTourProvider } from '@/components/providers/PageTourProvider';
import FloatingActionButtons from '@/components/FloatingActionButtons';
import ClientErrorCatcher from "@/components/ClientErrorCatcher";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

const russoOne = Russo_One({
  weight: "400",
  variable: "--font-russo",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#05060f",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "FitManager TMA",
  description: "FitManager Telegram Mini App",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FitManager",
  },
};

import { TelegramAuthProvider } from "@/components/providers/TelegramAuthProvider";
import { TonProvider } from "@/components/TonProvider";
import { LanguageProvider } from "@/components/LanguageContext";

import { PaddingProvider } from "@/components/providers/PaddingContext";
import { GlobalHeader } from "@/components/GlobalHeader";
import { BottomTabBar } from "@/components/ui/BottomTabBar";
import { Toaster } from "react-hot-toast";
import { TooltipTour } from "@/components/onboarding/TooltipTour";
import { AchievementToastProvider } from "@/components/AchievementToastProvider";
import { PageTransitionWrapper } from "@/components/providers/PageTransitionWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${orbitron.variable} ${russoOne.variable} ${spaceGrotesk.variable} antialiased`}
    >
      {/*
        ── LAYOUT STRATEGY ──────────────────────────────────────────────────
        h-dvh: fills the dynamic viewport (accounts for mobile browser chrome).
        overflow-hidden on <body> and <main>: prevents any page-level scroll.
        Each page/screen is responsible for its own internal scroll behaviour:
          - Use overflow-y-auto on the page's scrollable inner section
          - Use overflow-x-auto + snap-row on horizontal card carousels
          - Market and League pages are exempt and may scroll vertically
        ─────────────────────────────────────────────────────────────────── */}
      <body className="h-dvh overflow-hidden flex flex-col font-sans bg-midnight-abyss">
        <LanguageProvider>
          <TelegramAuthProvider>
            <TonProvider>
              {/* ── State providers (order matters: Tutorial depends on Auth) */}
              <PaddingProvider>

                  <PageTourProvider>
                    <main
                      role="main"
                      aria-label="Main Application Content"
                      className={`
                        max-w-[480px] w-full mx-auto
                        h-dvh overflow-hidden
                        bg-midnight-abyss text-white relative
                        shadow-2xl border-x border-white/5
                        flex flex-col
                      `}
                    >
                      {/* Decorative scan line */}
                      <div className="scan-line" />

                      {/* GlobalHeader is always visible at the top */}
                      <GlobalHeader />

                      {/*
                        ── CONTENT AREA ─────────────────────────────────────
                        min-h-0 is CRITICAL: without it, flex children ignore
                        parent's height constraint and overflow-hidden fails.
                        PageTransitionWrapper handles AnimatePresence routing.
                        ──────────────────────────────────────────────────── */}
                      <PageTransitionWrapper>
                        {children}
                      </PageTransitionWrapper>

                      {/* BottomTabBar is fixed, not in flow */}
                      <BottomTabBar />
                    </main>

                    {/* Tutorial tooltip overlay — rendered outside main for z-index */}
                    <TooltipTour />

                    <AchievementToastProvider />

                    <Toaster
                      position="top-center"
                      toastOptions={{
                        className: 'font-sans font-bold shadow-[0_0_15px_rgba(147,51,234,0.4)] bg-[#05060f] text-white border border-violet-500/50',
                        style: { marginTop: '70px' },
                      }}
                    />
                    <ClientErrorCatcher />
                    <FloatingActionButtons />
                  </PageTourProvider>

              </PaddingProvider>
            </TonProvider>
          </TelegramAuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
