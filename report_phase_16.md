# Phase 16: Profile Page & Settings UI

## Overview
Built the User Profile screen at `/profile` to centralize Telegram identity, Web3 interactions, and manual language management, utilizing the established Cyberpunk visual language.

## Data Mapping & UI Components
- **Identity Card:** Reads `first_name`, `last_name`, `username`, and `id` directly from `window.Telegram.WebApp.initDataUnsafe.user`. Styled with a `neon-cyan` thematic glow and placeholder avatar generator.
- **Web3 Integration:** Fetches `wallet_address` dynamically from our Next.js backend context. 
  - If connected: Displays the truncated address pulsing green.
  - If missing: Renders a `neon-pink` error state and dynamically mounts the `<WalletConnect />` button seamlessly.
- **Language Toggle:** Built a dual-tab selector managing the global React `LanguageContext` directly, actively repainting the UI layout and toggling between `Orbitron` and `Russo One` fonts instantly.

## Navigation
Added a high-visibility `Profile` navigational button directly beneath the Match Journal to complete the core user loop, maintaining the strict 480px structural layout logic without causing mobile clutter.
