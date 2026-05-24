import type { Metadata, Viewport } from "next";
import { Inter, Orbitron, Russo_One } from "next/font/google";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0B0F19",
};

export const metadata: Metadata = {
  title: "FitManager TMA",
  description: "FitManager Telegram Mini App",
  colorScheme: "dark",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FitManager",
  },
};

import { TelegramAuthProvider } from "@/components/TelegramAuthProvider";
import { TonProvider } from "@/components/TonProvider";
import { LanguageProvider } from "@/components/LanguageContext";
import { GlobalHeader } from "@/components/GlobalHeader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${orbitron.variable} ${russoOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <LanguageProvider>
          <TelegramAuthProvider>
            <TonProvider>
              <main 
                role="main"
                aria-label="Main Application Content"
                className="max-w-[480px] w-full mx-auto min-h-screen bg-space-dark text-white relative shadow-2xl overflow-hidden border-x border-gray-900/30 flex flex-col"
              >
                <GlobalHeader />
                <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">
                  {children}
                </div>
              </main>
            </TonProvider>
          </TelegramAuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
