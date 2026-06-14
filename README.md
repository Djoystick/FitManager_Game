<div align="center">
  <img src="https://img.shields.io/badge/Status-Beta-00f0ff?style=for-the-badge&logo=rocket" alt="Status" />
  <img src="https://img.shields.io/badge/Platform-Telegram_Mini_App-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" />
  <img src="https://img.shields.io/badge/Web3-TON_Network-0098EA?style=for-the-badge" alt="TON" />
  
  <br />
  <br />

  <h1>⚡ FitManager: Web3 Cyber-Football</h1>
  <p>
    <b>The First Move-to-Earn Football Manager on Telegram & TON.</b><br/>
    Convert your real-world sweat into digital glory.
  </p>
  
  <p>
    <a href="#about-the-project"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://t.me/FitManagerWeb3_bot/app">Play on Telegram</a>
    ·
    <a href="https://github.com/Djoystick/FitManager_Game/issues">Report Bug</a>
    ·
    <a href="https://github.com/Djoystick/FitManager_Game/issues">Request Feature</a>
  </p>
</div>

---

## 🚀 About The Project

**FitManager** is a revolutionary Web3 Telegram Mini App (TMA) that merges **Football Management**, **Move-to-Earn (M2E)**, and **DeFi** on the TON blockchain. 

Instead of waiting for energy to recharge or buying micro-transactions, managers must physically move in the real world (run, walk, gym) to earn **Training Points (TP)**. These points are used to train your cyber-squad, upgrade facilities, and dominate the Web3 leagues. 

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
</div>

## 🔥 Key Features (Currently Implemented)

* 🏃 **Real-World Sync (W2E Sweat Bank):** Connect your fitness tracker. Your real-world steps convert into **Sweat Points (SP)** through a specialized manager profile (Runner, Gym Bro, Footballer, Coach).
* ⚽ **Match Engine v4.0 (Micro-Duels & Real-time Events):** An ultra-deep backend engine simulating matches phase-by-phase. It calculates xG dynamically, applies OOP (Out of Position) penalties, tracks stamina drain per minute, and triggers rare situational events.
* 📊 **Deep Match Analytics & Reports:** Post-match screens providing granular data—xG (Expected Goals), possession stats, interactive timelines with goalscorers, cards, and injuries.
* 🏙️ **Club Infrastructure:** Upgrade your Stadium, Medical Center, Academy, and Training Camp to gain passive FanCoins (FC), tax exemptions, and recovery buffs.
* 🤖 **Smart Telegram Notifications:** Get real-time alerts pushed straight to your Telegram DMs when a match finishes. See the final score, injuries, and your league standing directly in chat.
* 🌐 **Immersive Cyberpunk UI & Dashboards:** A fully redesigned Next.js dashboard featuring smooth Framer Motion page transitions, unified global loading screens, dynamic "Next Match" countdowns, and a mini-standings widget.
* 🌍 **Native Multilingual Support (i18n):** Seamlessly switch between English and Russian localizations, covering everything from the UI to match commentary and onboarding tutorials.
* 🛡️ **Anti-P2W "Economy v2" System:**
  * **The Glass Ceiling:** You can train players with soft-currency (FanCoins) only up to 69 OVR. To train stats to 70+, you MUST use physical Sweat Points. Whales cannot simply buy their way to 99 OVR.
  * **Form Decay:** Superstars (78+ OVR) require a daily physical maintenance fee in Sweat Points. If unpaid, their Pace and Physical stats decay automatically.
  * **Exponential Salaries:** High OVR players demand massive FC salaries per match, forcing managers to actively trade, walk, or upgrade infrastructure to avoid bankruptcy.
* 🏆 **10-Tier Global Leagues:** Fight through 10 divisions with automatic Promotion and Relegation. Fully automated cron-job scheduling handles daily matchdays and end-of-season rewards.
* 📱 **Native Telegram Integration:** Frictionless onboarding via Telegram WebApp SDK. Seamless UI built for mobile screens. Now featuring **Native Fullscreen Mode** for maximum immersion.
* 🎓 **Interactive Onboarding:** A step-by-step interactive tutorial that guides new managers through the UI upon their first login.
* 💎 **Prize Waterfall (TON Treasury):** Dynamic Asynchronous Treasury Drain! Every time a league season finishes, it takes a percentage of the Global TON Treasury and distributes it to the Top-3 managers.
* 💻 **Advanced Admin Console & Dev Tools:** Built-in dashboard for developers to monitor system logs in real-time, resolve errors, and utilize a powerful **Cheat Menu**.

## 🛠️ Architecture & Tech Stack

* **Frontend:** Next.js 15 (App Router), React 19, TailwindCSS, Framer Motion
* **Backend:** Next.js Server Actions, API Routes
* **Database:** Supabase (PostgreSQL) with advanced RPC functions and Triggers
* **Authentication:** Telegram WebApp SDK (`@twa-dev/sdk`), Ed25519 Signature Verification
* **Automation:** Cron-job.org triggering Vercel API endpoints for match simulations
* **Web3:** TON Connect SDK

## ⚙️ Quick Start

To get a local copy up and running, follow these steps.

### Prerequisites

* Node.js (v18+)
* Supabase Account
* Telegram Bot Token (from BotFather)

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/Djoystick/FitManager_Game.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Set up your `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   TELEGRAM_BOT_TOKEN=your_bot_token
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   CRON_SECRET=your_secure_cron_secret
   ```
4. Start the development server
   ```sh
   npm run dev
   ```

## 🎮 How to Play

1. **Found Your Club:** Open the TMA via Telegram. Pick your franchise name and get your initial draft of players.
2. **Move & Sync:** Go for a run! Sync your activity in the app to get Training Points.
3. **Train:** Use TP to boost your players' OVR (Overall Rating).
4. **Compete:** Matches are simulated automatically every hour. Watch your stamina!
5. **Trade:** Sell your best players on the Web3 Market for TON and buy new superstars.

---

<div align="center">
  <p>Built with ❤️ by the FitManager Team.</p>
  <a href="https://github.com/Djoystick/FitManager_Game">
    <img src="https://img.shields.io/github/stars/Djoystick/FitManager_Game?style=social" alt="Stars" />
  </a>
</div>
