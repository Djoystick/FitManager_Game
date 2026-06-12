# FitManager Future Roadmap — Path to Top Eleven

> **Vision:** Transform FitManager from a polished single-player football manager with social skin into a genuinely social competitive experience where every session involves real human interaction — while maintaining the unique W2E (Move-to-Earn) differentiator that Top Eleven lacks.

---

## Current State Assessment

### What Works Well
- Sophisticated match engine with logistic duel, chemistry, traits, and tactical styles
- Cyberpunk UI is polished, mobile-first, and visually distinctive
- W2E integration (physical activity → player strength) is a unique market position
- 15-tier hierarchical league system with promotion/relegation
- Atomic RPC for finance operations (where used)
- CAS locking on season transitions

### What's Broken or Missing
- Zero PvP interaction (all friendlies are vs bot)
- No friends system, no discovery, no search
- Social feed is a bulletin board (no conversation)
- Economy has no functioning inflation controls
- Most league opponents are bots
- No tournaments, cups, or special events
- No manager identity or reputation system

---

## Phase 1: Foundation (P0) — Security & Stability

> **Goal:** Make the game safe to play. Fix all critical vulnerabilities and architectural flaws.

### 1.1 Security Hardening
- Enable RLS on all core tables (`users`, `teams`, `players`, `matches`, `league_standings`)
- Fix all auth bypasses (friendly route, notifications POST, 4+ API routes)
- Fix all IDOR vulnerabilities in server actions (11+ functions)
- Remove `CRON_SECRET_MANUAL` query parameter auth
- Add rate limiting to all user-facing endpoints

### 1.2 Race Condition Fixes
- Add `SELECT ... FOR UPDATE` + status check to `resolveMatch`
- Replace non-atomic balance operations with atomic RPCs
- Unify building upgrade cost formula across both entry points

### 1.3 Economy Stabilization
- Wire up `economy_state` multipliers OR remove dead code
- Use deterministic randomness for economy-critical paths (ticket revenue, free agent generation)
- Set bot initial FC to 0
- Add treasury audit trail for all deductions
- Add `dribbling` stat to free agent generation

### 1.4 Match Engine Fixes
- Pass match form data to the engine (enable form system)
- Fix position group overlap (CAM, CDM)
- Fix FC fallback race condition in `resolveMatch`

**Duration:** 1–2 sprints
**Success Metric:** All CRITICAL and HIGH security/architecture findings resolved. `npx tsc --noEmit` clean. Automated tests for match engine and economy RPCs.

---

## Phase 2: Social Core (P1) — PvP & Friends

> **Goal:** Make the game social. Players should interact with other real humans every session.

### 2.1 PvP Challenge System
**The single most impactful feature for social engagement.**

- Allow managers to challenge any player in their league or friends list
- Both players set lineups → match simulates asynchronously
- Winner gets FC + SP; loser gets consolation reward (reduced FC, no SP loss)
- Challenge history visible on manager profiles
- Cooldown: 3 challenges per day per opponent to prevent spam
- Anti-collusion: price clamping and cooldowns between same managers

**Database changes:**
- `challenges` table: challenger_id, opponent_id, status (pending/accepted/rejected/completed), result
- `challenge_results` table: match_id reference, scores

### 2.2 Friends/Contacts System
- Search for managers by team name (fix the broken SEARCH tab)
- Send friend request → accept/decline flow
- Friends list visible in a dedicated UI section
- Online status indicator (last active timestamp)
- Friends feed: see when friends win matches, make transfers, achieve milestones

**Database changes:**
- `friendships` table: user_a, user_b, status, created_at
- Index on both user columns for fast lookups

### 2.3 Functional SEARCH Tab
- Search by team name, manager name, or league tier
- View manager profiles (public stats: wins, losses, league position, trophy count)
- "Challenge" button on profile page
- "Add Friend" button on profile page

### 2.4 Match Chat / League Chat
- Per-match chat room (pre-match trash talk, post-match GG)
- Per-league global chat room
- System messages auto-posted for goals, transfers, promotions
- Simple message table with user_id, match_id/league_id, message, created_at

**Duration:** 2–3 sprints
**Success Metric:** Players can challenge real opponents. Friends list exists. Search works. Daily active sessions increase 2x.

---

## Phase 3: Gameplay Depth (P2) — Management Realism

> **Goal:** Make management decisions matter. Create emotional investment in players and club.

### 3.1 Squad Morale System
**Creates dynamic that rewards thoughtful management over pure stat grinding.**

- Player morale affected by: playing time, match results, wage satisfaction, team performance
- Low morale → stat penalty (up to -10%)
- High morale → stat bonus (up to +5%)
- Manager decisions (lineup, formation, friendly matches) affect morale
- Morale visible on player cards with color indicators
- Weekly morale update (cron job)

**Database changes:**
- Add `morale` column to `players` table (0-100, default 70)

### 3.2 Youth Academy Intake
**Makes the Academy building meaningful beyond a passive stat boost.**

- Seasonal youth intake (every season end)
- Academy level affects quality/quantity of youth players generated
- Players must choose which youth players to keep (squad size limit: 25)
- Youth players have hidden potential that reveals over time
- Creates narrative: "Will this 16-year-old with 85 potential be the next star?"

**Database changes:**
- `youth_intake` table: team_id, season_id, players (JSONB array), offered_at
- Youth players get `potential_limit` but not `ovr` initially

### 3.3 Transfer Negotiations
**Makes the market strategic, not just a price tag.**

- Instead of flat price, allow counter-offers
- Offer system: propose player + cash for another player
- Auto-accept thresholds configurable by manager
- Transfer window with deadline (creates urgency)
- Creates strategic depth: "Do I sell my star striker for 5000 TON + their defender?"

**Database changes:**
- `transfer_offers` table: offerer_id, target_listing_id, offered_player_id, offered_cash, status
- `transfer_windows` table: start_date, end_date, type (league, international)

### 3.4 Sponsorship Contracts
**Creates daily engagement hooks beyond training.**

- Weekly sponsor objectives (e.g., "Win 3 matches", "Score 5+ goals", "Keep a clean sheet")
- Completing objectives earns bonus FC/SP/TON
- Sponsor tiers: Basic → Premium → Elite (based on league tier)
- Creates daily goals that drive login frequency

**Database changes:**
- `sponsorships` table: team_id, sponsor_tier, objectives (JSONB), reward, expires_at
- `sponsorship_progress` table: objective tracking

**Duration:** 3–4 sprints
**Success Metric:** Players make meaningful management decisions. Average session length increases 30%. Retention at Day 7 improves 25%.

---

## Phase 4: Competition (P3) — Tournaments & Rivalries

> **Goal:** Create high-stakes moments outside the league calendar. Build narratives.

### 4.1 Cup/Tournament Mode
- **National Cup:** Knockout bracket, all teams in the same tier
- **International Cup:** Cross-tier knockout (top teams from different tiers)
- **Community Cup:** Monthly tournament with special rules (e.g., only players under 23)
- Creates high-stakes moments: "Do I rotate my squad for the cup or focus on the league?"
- Bracket visualization in the HUB tab

**Database changes:**
- `tournaments` table: type, tier_bracket, status, current_round
- `tournament_matches` table: similar to `league_matches` but with bracket structure

### 4.2 Season Awards
- **Golden Boot:** Top scorer across all leagues
- **Best Manager:** Most points across all leagues
- **Best Defense:** Fewest goals conceded
- **Best Newcomer:** Highest-rated player under 21
- Awards auto-awarded at season end
- Winners get special badges displayed on profile
- Creates narratives and rivalries

**Database changes:**
- `season_awards` table: award_type, winner_id, season_id, value

### 4.3 Manager Rivalry System
- Track head-to-head record between any two managers across all competitions
- Display "derby" badge for frequent opponents (3+ matches)
- Special rewards for winning a rivalry matchup
- Historical record visible on profiles
- Creates personal narratives: "I'm 2-1 up against this guy this season"

### 4.4 Trophy Cabinet
- Visual display of all achievements, league titles, promotion medals
- Shareable "season summary" card (image export to Telegram Stories)
- Compare trophy cabinets with other managers
- Creates aspiration and long-term goals

**Duration:** 3–4 sprints
**Success Metric:** Tournament participation > 60% of active users. Season awards generate social feed buzz. Rivalry narratives emerge in WOOF feed.

---

## Phase 5: Social Scale (P4) — Community & Identity

> **Goal:** Build lasting community. Players should feel they belong to something bigger.

### 5.1 Alliances/Guilds (Clubs)
- Create or join an alliance (max 20 members)
- Alliance chat channel
- Alliance vs Alliance weekly challenges
- Shared alliance treasury (members contribute FC/TON)
- Alliance rankings on a global leaderboard
- Creates collective identity and long-term commitment

**Database changes:**
- `alliances` table: name, description, owner_id, created_at
- `alliance_members` table: user_id, alliance_id, role (leader/member), joined_at
- `alliance_challenges` table: alliance_a, alliance_b, status, result

### 5.2 Cooperative Challenges
- Alliance members work together toward common goals
- "Win 50 matches as an alliance this week" → everyone gets bonus rewards
- "Score 100 goals collectively" → unlock exclusive cosmetics
- Creates interdependence: "I need my alliance mates to succeed"

### 5.3 Live Match Events
- Real-time match simulation visible to both managers
- Live event feed: goals, cards, substitutions appear as they happen
- "Watch" button on upcoming matches
- Creates tension and excitement: "Can we hold the lead for 5 more minutes?"

### 5.4 Manager Profile & Reputation
- Public profile with: stats, trophies, league history, H2H records
- Manager rating based on win rate, league tier, tournament results
- "Manager of the Month" recognition
- Profile customization (avatar, bio, favorite formation)
- Creates identity and aspiration

### 5.5 Enhanced WOOF Feed
- Add replies/threads to posts (currently one-way)
- Add @mentions to notify specific managers
- Add post categories with filtering
- Auto-post system events (transfers, promotions, awards)
- Create "trending" posts based on engagement
- Transform from bulletin board to genuine conversation

**Duration:** 4–6 sprints
**Success Metric:** Alliance membership > 40% of active users. WOOF posts per day increase 5x. 30-day retention improves 40%.

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| PvP Challenge System | 🔴 Critical | Medium | **P1** |
| Friends System | 🔴 Critical | Medium | **P1** |
| Security Fixes | 🔴 Critical | Low-Medium | **P0** |
| Economy Stabilization | 🟡 High | Low | **P0** |
| Functional SEARCH | 🟡 High | Low | **P1** |
| Squad Morale | 🟡 High | Medium | **P2** |
| Cup/Tournament Mode | 🟡 High | High | **P3** |
| Youth Academy Intake | 🟢 Medium | Medium | **P2** |
| Transfer Negotiations | 🟢 Medium | High | **P2** |
| Sponsorships | 🟢 Medium | Medium | **P2** |
| Match Chat | 🟢 Medium | Low-Medium | **P1** |
| Trophy Cabinet | 🔵 Low | Low | **P3** |
| Alliance/Guild System | 🟡 High | High | **P4** |
| Live Match Events | 🟢 Medium | High | **P4** |
| Season Awards | 🔵 Low | Low | **P3** |

---

## Unique Differentiator: W2E + Social

FitManager's competitive advantage over Top Eleven is the **Move-to-Earn integration**. No other football manager game rewards physical activity with in-game power. The roadmap should amplify this:

1. **Alliance Fitness Challenges:** "Your alliance collectively walked 100km this week → bonus rewards"
2. **Derby Fitness Boost:** Before a rivalry match, extra W2E coins for recent physical activity
3. **Season Fitness Milestone:** Players who maintain activity throughout a season get exclusive cosmetics
4. **Social Sharing:** "I trained 5km today and my striker gained +2 Shooting" — shareable cards

This creates a feedback loop that Top Eleven cannot replicate: **physical activity → player strength → competitive advantage → social status → motivation to stay active.**

---

*Roadmap generated by Lead Game Architect audit — FitManager June 2026*
