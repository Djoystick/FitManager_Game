# Phase 11: Staff Evolution & Aging Mechanics

## Overview
Phase 11 introduces a dynamic biological lifecycle to the "FitManager_Game" TMA. To ensure continuous economic movement and prevent perpetual dominance by legacy squads, players age organically over time. Upon reaching exactly 35 years of age, athletes permanently retire from active competition on the pitch, evolving into highly coveted "NFT Coaches" that grant passive XP bonuses to their franchise.

## 1. CRON Aging Endpoint (`app/api/cron/age-players/route.ts`)
A strictly typed, secure `GET` endpoint was implemented to act as the central driver of time within the game universe. It is secured symmetrically to the league simulator via the `Authorization: Bearer <CRON_SECRET>` server protocol.

### Execution Flow
1. **Targeting Active Athletes**: The script targets and fetches all database records from the `players` table explicitly where `is_nft_coach = false`.
2. **Biological Aging**: Every fetched player iterates, incrementing their `age` by `1`.
3. **The Retirement Horizon**: The algorithm scans the modified dataset. If a player's new age hits `35` (or greater), the "Staff Evolution" sequence initiates natively via the Supabase client:
   - **State Shift**: `is_nft_coach` is permanently flipped to `true`. This functionally excludes them from any future CRON match simulations and lineup verification layers.
   - **Perk Injection**: The `perks` JSONB array is dynamically appended. The retiring player absorbs a new metadata object (`{ "coach_bonus": "XP_BOOST_10_PERCENT", "legacy_ovr": <their_current_ovr> }`), transforming them from an active player into a valuable passive staff asset.

### 2. Market Cleanup Safety Measures
When a player retires, their utility and valuation fundamentally change, as they can no longer be fielded in active competition. 
To rigorously prevent "zombie" or fraudulent listings from lingering:
- The aging script immediately issues a cascading `DELETE` against the `transfer_market` table targeting the newly retired `player_id`. 
- This instantaneously purges the retired player from the public Web3 P2P market, safely protecting buyers from purchasing an unplayable asset.

## Summary
The complete player lifecycle loop is now securely established. The evolution into NFT Coaches imbues legacy players with long-term intrinsic economic value despite their physical retirement, crafting a deeply engaging, multi-generational franchise management experience seamlessly integrated with PostgreSQL logic.
