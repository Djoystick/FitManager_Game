import Link from 'next/link';

export default function TermsPage() {
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
          Terms of Service
        </h1>

        <div className="bg-black/60 backdrop-blur-md border border-gray-800 p-6 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-6 text-gray-300 font-inter text-sm leading-relaxed">
          
          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">1. Acceptance of Terms</h2>
            <p>
              By accessing and playing FitManager (the "Game"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Game.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">2. Fair Play & Anti-Cheat</h2>
            <p>
              The use of third-party bots, emulators, auto-clickers, or any software designed to manipulate Sweat Points or match results is strictly prohibited. Violators will face permanent bans without compensation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">3. Virtual Assets & Economy</h2>
            <p>
              In-game currencies (FanCoins, Sweat Points) and digital assets (players, NFTs) have no guaranteed real-world value. The developers reserve the right to modify, balance, or reset the economy to maintain game health.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">4. User Content</h2>
            <p>
              Team names, logos, and communication must comply with standard decency rules. Offensive, illegal, or heavily controversial content will result in warnings or bans.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2 font-orbitron">5. Disclaimer of Warranties</h2>
            <p>
              The Game is provided "AS IS". We do not guarantee uninterrupted service, completely bug-free gameplay, or the preservation of virtual assets in the event of unforeseen server failures or blockchain network issues.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
