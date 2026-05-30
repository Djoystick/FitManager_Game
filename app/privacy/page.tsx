/* eslint-disable react/no-unescaped-entities */
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="flex flex-col flex-1 min-h-screen bg-[#0B0F19] items-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-20%] w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neon-cyan/5 via-[#0B0F19]/80 to-[#0B0F19] pointer-events-none" />
      
      <div className="w-full max-w-2xl z-10 flex flex-col pt-10 pb-20">
        
        <Link 
          href="/onboarding" 
          className="text-neon-cyan hover:text-white font-orbitron text-sm mb-8 flex items-center gap-2 transition-colors w-fit"
        >
          ← Back
        </Link>

        <h1 className="text-3xl font-black text-white mb-8 tracking-wide font-orbitron drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
          Privacy Policy
        </h1>

        <div className="bg-black/60 backdrop-blur-md border border-gray-800 p-6 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-6 text-gray-300 font-inter text-sm leading-relaxed">
          
          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">1. Data We Collect</h2>
            <p>
              When you use FitManager as a Telegram Mini App, we collect your basic Telegram profile data (ID, username, first name) to create and identify your in-game account. We do not have access to your private messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">2. Fitness Data (Move-to-Earn)</h2>
            <p>
              To reward you with Sweat Points, we may require access to your device's step counter or fitness APIs. This data is strictly used to calculate in-game rewards and is never sold to third-party marketers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">3. Blockchain Transactions</h2>
            <p>
              Any interactions with the TON blockchain (such as minting NFTs or market trades) are public by nature. We do not store your private keys. You are solely responsible for the security of your connected Web3 wallet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">4. Data Storage & Security</h2>
            <p>
              Your game progress, squad data, and balances are stored securely in our databases. We employ industry-standard security measures, but no system is 100% immune to breaches.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">5. Contact Us</h2>
            <p>
              For data deletion requests or privacy-related questions, please contact our support team via our official Telegram community.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
