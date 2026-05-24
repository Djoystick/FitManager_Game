# Phase 18: Tactical Pitch Refactor & Advanced Stats

## Overview
Following the introduction of procedural squad generation in Phase 17, the tactical interface required a significant structural overhaul to fully leverage the newly generated player metadata. The lineup UI has been upgraded from a simple grid to a fully positional tactical pitch, reflecting each player's distinct role and displaying their comprehensive stat block.

## Structural Changes to the Pitch Layout
The generic 3-column roster grid in `app/lineup/page.tsx` was dismantled and replaced with a responsive, flex-based vertical pitch layout.

- **Positional Stratification**: The glowing pitch now intrinsically acts as a vertical flex container (`justify-between`), distinctly dividing the playing area into four horizontal zones:
  - **Forwards (FWD)**: Positioned at the extreme top of the pitch.
  - **Midfielders (MID)**: Dominating the central upper third.
  - **Defenders (DEF)**: Holding the defensive third near the penalty box.
  - **Goalkeeper (GK)**: Anchored at the absolute bottom.
- **Dynamic Allocation**: The incoming active player roster is programmatically segregated by their `position` tag. Each array of positional players is mapped dynamically across their assigned horizontal line using `flex justify-around`, ensuring even horizontal distribution regardless of how many players occupy that specific line (e.g., automatically spacing 4 defenders or 2 forwards).

## Integration of Detailed Player Stats (Micro-Cards)
To display the granular stats `{ pace, shooting, passing, defending, physical }` without breaking the strict 480px mobile constraint, a highly compact "Micro-Card" UI pattern was engineered.

### Micro-Card Anatomy
1. **Positional Header**: The top of the card features a high-contrast `neon-cyan` badge denoting the player's position, set against a transparent gradient banner. The overall OVR sits prominently opposite the badge.
2. **Compact Typography**: To guarantee that up to 5 cards (e.g., a heavy midfield) can fit side-by-side on narrow screens, width constraints (`max-w-[85px]`) and sub-10px responsive typography scales were utilized.
3. **Stat Grid**: A dense `grid-cols-2` layout was appended to the bottom of the card. It presents abbreviated stats (PAC, SHO, PAS, DEF, PHY) using a crisp, microscopic `font-orbitron` implementation. The raw metric values are highlighted in `neon-green` to draw the manager's eye to high-performing attributes.

## API & Data Access Adjustments
The `/api/team/my-team` endpoint's internal Supabase select query was updated to fetch the new `position` and `stats` columns. This prevents UI hydration errors and securely transmits the procedural JSONB blob strictly for the authenticated user's current roster.
