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

        <div className="bg-black/60 backdrop-blur-md border border-gray-800 p-6 md:p-8 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-8 text-gray-300 font-inter text-sm md:text-base leading-relaxed">
          
          <div className="text-center pb-4 border-b border-gray-800/50">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Effective Date: June 10, 2026</p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">1.</span> Introduction
            </h2>
            <p>
              Welcome to <strong>FitManager</strong> ("we", "our", or "us"). We are committed to protecting your privacy and ensuring you have a positive experience while playing our game. FitManager is a Telegram Mini App game that integrates physical activity to reward players with in-game resources.
            </p>
            <p className="mt-2">
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application and, specifically, how we handle data received from Google APIs (Google Fit).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">2.</span> Google API Services User Data Policy Compliance
            </h2>
            <div className="bg-cyan-950/30 border border-cyan-900/50 p-4 rounded-xl text-cyan-100/80">
              <strong>FitManager's use and transfer to any other app of information received from Google APIs will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</strong>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">3.</span> Information We Collect
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Telegram User Data:</strong> We collect your basic Telegram ID, username, and profile picture to create and authenticate your in-game account.</li>
              <li><strong>Fitness Data (via Google Fit):</strong> If you explicitly authorize our application, we request read-only access to your physical activity data. Specifically, we read your <strong>Step Count</strong> (`com.google.step_count.delta`). We DO NOT request or read any other health metrics (e.g., heart rate, weight, location).</li>
              <li><strong>Authentication Tokens:</strong> We securely store OAuth access and refresh tokens required to maintain the synchronization with Google Fit.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">4.</span> How We Use Your Information
            </h2>
            <p>We use the collected information strictly for providing and improving the game mechanics:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>To synchronize your physical real-world steps with the game.</li>
              <li>To convert your step count into in-game currency (such as Stamina Points or FanCoins) to heal your players and progress in the game.</li>
              <li>To authenticate you and maintain your game progress.</li>
            </ul>
            <p className="mt-3 text-red-400 font-bold border-l-2 border-red-500 pl-3">
              We DO NOT use your fitness data for advertising, nor do we sell it to data brokers or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">5.</span> Data Storage and Security
            </h2>
            <p>
              Your data is stored in a secure, encrypted PostgreSQL database (Supabase). We implement industry-standard security measures, including TLS/SSL encryption for data in transit and encrypted storage for OAuth tokens. Only authorized automated systems within our backend can access your fitness data to perform the daily step-to-currency conversion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">6.</span> Data Sharing and Disclosure
            </h2>
            <p>
              We do not share, sell, or rent your personal information or fitness data to third parties. We may only disclose information if required to do so by law or in response to valid requests by public authorities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">7.</span> User Rights, Revocation & Data Deletion
            </h2>
            <p>You have full control over your data:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Revoke Access:</strong> You can disconnect Google Fit from FitManager at any time via the in-game settings. Additionally, you can revoke FitManager's access directly from your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Google Account Security page</a>.</li>
              <li><strong>Data Deletion:</strong> If you delete your FitManager account or revoke Google Fit access, we immediately delete your OAuth tokens and cease all synchronization. Past steps that were already converted into in-game currency remain as anonymous game stats, but all link to your Google account is destroyed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 font-orbitron flex items-center gap-2">
              <span className="text-cyan-400">8.</span> Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact our support team via Telegram or at <strong>support@fitmanager.game</strong>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
