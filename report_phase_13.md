# Phase 13: Tactical Lineup UI & Luxury Tax Integration

## Overview
Phase 13 delivers the heavily anticipated "Tactical Lineup" view to the TMA. This specialized frontend interface empowers managers to comprehensively visualize their current roster, precisely monitor their squad's overall power, and submit their lineup for the upcoming match round—seamlessly interfacing with the stringent economic "Luxury Tax" backend constructed in Phase 10.

## 1. Data Fetching Layer (`app/api/team/my-team/route.ts`)
A streamlined `GET` API was engineered to furnish the UI with holistic franchise data in a single round trip.
- Inheriting the `userId` query parameter from the client, the endpoint natively searches the `teams` table to retrieve core franchise configuration metadata.
- Simultaneously, it performs a highly optimized lookup on the `players` table, returning all athletes tied to the franchise ID. This array payload incorporates essential attributes: `age`, `ovr`, and `is_nft_coach`.

## 2. Tactical UI Architecture (`app/lineup/page.tsx`)
The user interface was crafted as a dedicated Next.js Client Component (`/lineup`) adhering strictly to the mobile dimensions and custom Cyberpunk aesthetic.
- **The Pitch Visualization**: Rendered using pure, highly customized Tailwind CSS divs. It features a stylized, transparent `neon-green` illuminated football pitch outline resting on a deep `bg-green-950` glassmorphism surface.
- **Player Segregation**: The UI dynamically segments the fetched `players` payload:
  - **Active Athletes**: Rendered as glowing, `neon-cyan` tactile cards superimposed directly over the Pitch.
  - **Retired Staff**: Players affected by the biological aging mechanic (`is_nft_coach = true` from Phase 11) are filtered out of the tactical overlay to prevent invalid match logic, and are respectfully showcased in a specialized "Staff Roster" horizontal carousel at the bottom of the screen.
- **Luxury Tax HUD (Heads-Up Display)**: 
  - The client instantly crunches the true average OVR of the active players array.
  - An intelligent HUD proactively monitors this metric against the `80 OVR` soft-cap.
  - If the squad remains beneath the cap, the HUD glows a calming green ("Tax Exempt").
  - If the OVR limit is violently breached, the HUD transitions instantly to an aggressive pulsing `neon-pink`, dynamically broadcasting the precise FanCoin penalty required to submit the squad.

## 3. Submission Protocol Integration
- **Submit Lineup Interaction**: The core CTA is an unmissable, highly stylized block button.
- Upon click, it dispatches a secured `POST` payload to `/api/team/submit-lineup`.
- **Intelligent State Handling**: 
  - If the backend approves, the UI parses the tax paid, presents a localized success terminal message, and dynamically locks the button state into a glowing `neon-green` "Match Ready" mode.
  - If the backend rejects the transaction (e.g., "Insufficient FanCoins"), the frontend explicitly traps the `400 Bad Request` and natively prints the API error in a red terminal alert block. This entirely avoids unhandled frontend crashes while effectively communicating the exact economic blockage to the user.

## Summary
The manager’s core tactical sandbox is now fully operational. The beautiful synergy between the visual lineup interface and the brutal backend economy creates a deeply engaging loop: players must constantly balance their squad's raw statistical power against their liquid FanCoin reserves generated through real-world fitness.
