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
    <a href="https://t.me/FitManagerBot">Play on Telegram</a>
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

## 🔥 Key Features

* 🏃 **Real-World Sync (M2E):** Connect your fitness tracker. Your real-world miles become in-game Training Points (Cardio, Strength, Fitness, Ball).
* ⚽ **Deep Tactical Engine:** Manage formations, player stamina, and scout intel. Every match is simulated fully on the backend via automated Cron Jobs.
* 🏙️ **Club Infrastructure:** Upgrade your Stadium, Medical Center, and Training Camp to gain passive FanCoins (FC) and team buffs.
* 💎 **P2P Transfer Market (TON):** Fully decentralized player market. Sell your trained academy players to other real managers for actual **TON cryptocurrency**.
* 🏆 **Global Multiplayer Leagues:** Fight through 15 tiers of leagues. If a tier lacks real players, it's instantly auto-filled with intelligent AI Bots.
* 📱 **Native Telegram Integration:** Frictionless onboarding. One click to play, no separate app installation required.

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
