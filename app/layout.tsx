import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <TelegramAuthProvider>
          <main 
            role="main"
            aria-label="Main Application Content"
            className="max-w-[480px] w-full mx-auto min-h-screen bg-space-dark text-white relative shadow-2xl overflow-hidden border-x border-gray-900/30"
          >
            {children}
          </main>
        </TelegramAuthProvider>
      </body>
    </html>
  );
}
