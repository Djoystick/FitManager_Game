# Phase 17: Franchise Onboarding & Procedural Generation

## Overview
This phase introduces a robust onboarding flow for new users joining FitManager. Previously, players without a team would simply encounter a "No Franchise Detected" error. Now, they are presented with a seamless "Create Your Franchise" interface, which subsequently triggers a procedural generation system to assemble their inaugural squad.

## Procedural Squad Generation
To ensure each manager starts with a unique team tailored for initial progression, we've implemented a procedural player generation system inside our new `/api/team/create` endpoint.

### 1. The Generation Logic
The `generatePlayer(teamId, position)` function acts as the core of the procedural factory:
- **Base Stats Allocation**: A new robust JSONB `stats` model was added to the `players` table encompassing `pace`, `shooting`, `passing`, `defending`, and `physical`. For the starter squad, these are randomized between `45` and `65` to simulate a low-tier, rookie team that the player must upgrade over time.
- **Dynamic OVR Calculation**: The `ovr` (Overall Rating) is mathematically derived as the exact average of these core stats.
- **Potential Limit Generation**: Each player receives a `potential_limit` ranging from `ovr + 5` to `90`, offering significant variance in how much each starter player can realistically develop.
- **Position Allocation**: The engine guarantees a structured starter lineup by distributing exact roles: 1 Goalkeeper (GK), 4 Defenders (DEF), 4 Midfielders (MID), and 2 Forwards (FWD).

### 2. Schema Enhancements
A new database migration (`00005_add_player_stats_and_position.sql`) was created to properly define the procedural extensions:
- Added `position VARCHAR(10)` to explicitly track roles.
- Added `stats JSONB DEFAULT '{}'::JSONB` to decouple granular performance metrics from the existing `perks` system, providing clean, extensible data separation.

## Onboarding UI Flow
The `DashboardPage` (`app/page.tsx`) was upgraded to seamlessly intercept user sessions without an assigned franchise:
1. **Intelligent Routing**: On mount, the component fetches both standard user economy data and team metadata concurrently.
2. **Form Presentation**: If a `404` team status is detected, the standard dashboard view is bypassed, and a sleek, neon-themed "Create Your Franchise" form takes its place.
3. **Data Hydration**: Submitting a franchise name triggers the backend procedural pipeline. During this, the UI enforces a `Drafting Players...` loading state. Upon successful database resolution, the app silently re-fetches context and immediately reveals the fully hydrated dashboard view, completing the onboarding loop natively.

## Transaction Safety Measures
Given REST limits standard PostgreSQL atomic transactions natively on the client, pseudo-transactional safety was enforced:
- **Rollback Routine**: The API commits the `teams` row first. It then attempts the batch-insert of the 11 procedurally generated `players`.
- **Fault Recovery**: If the player batch insertion fails (e.g. timeout or constraint violation), the endpoint explicitly deletes the orphan `teams` row before returning a `500` error, ensuring data consistency and allowing the user to seamlessly retry the operation without entering a broken state.
