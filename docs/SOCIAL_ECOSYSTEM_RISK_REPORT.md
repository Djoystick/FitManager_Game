# SOCIAL ECOSYSTEM RISK REPORT — FitManager Game

**Audit Date:** 2025-06-14
**Scope:** Social Ecosystem & Progression Update — Mathematical Modeling
**Auditor:** Lead Systems Analyst & Game Designer

---

## Executive Summary

The proposed Social Ecosystem introduces **4 critical risks** that could break the game economy and progression:

1. **XP Curve is BROKEN** — Level 5 takes 9.4 months, Level 10 takes 47.6 months. The game will be unplayable for 99% of users.
2. **Level Buffs Create Hyperinflation** — At Level 50 (+50% reward), veterans earn 3x more FC than new players, destroying competitive balance.
3. **Referral System is ABUSABLE** — Despite the Level 3 requirement, Sybil attacks are profitable at scale (22 FC/hour per alt).
4. **PvP Devalues Regular Friendlies** — Free PvP with XP reward makes paid friendlies obsolete.

**Recommended Values:** Revised XP curve, capped level buffs, referral cooldowns, and PvP XP caps.

---

## 1. XP Curve Analysis (CRITICAL ISSUE)

### Proposed Formula: `XP_needed = 500 × Level^1.5`

| Level | XP Needed | Cumulative XP | Days to Reach (50 XP/day) | Months |
|-------|-----------|---------------|---------------------------|--------|
| 1 | 500 | 500 | 10 | 0.3 |
| 2 | 1,414 | 1,914 | 39 | 1.3 |
| 3 | 2,598 | 4,512 | 91 | 3.0 |
| 5 | 5,590 | 14,102 | 283 | **9.4** |
| 10 | 15,811 | 71,334 | 1,427 | **47.6** |
| 20 | 44,721 | 380,392 | 7,608 | 253.6 |
| 50 | 176,777 | 3,624,333 | 72,487 | 2,416.2 |

### Problem
- **Level 5 (Transfer Market)** is locked behind 9.4 months of play. This is a critical anti-bot measure, but it also blocks legitimate players from the core economy.
- **Level 10 (Clans)** requires 47.6 months (4 years). No one will ever reach this.
- **Level 50** requires 200+ years. The feature is effectively dead.

### Recommended Formula: `XP_needed = 200 × Level^1.2`

| Level | XP Needed | Cumulative XP | Days to Reach | Months |
|-------|-----------|---------------|---------------|--------|
| 1 | 200 | 200 | 4 | 0.1 |
| 2 | 460 | 660 | 14 | 0.5 |
| 3 | 757 | 1,417 | 29 | 1.0 |
| 5 | 1,442 | 3,716 | 75 | **2.5** |
| 10 | 3,155 | 13,356 | 267 | **8.9** |
| 20 | 6,570 | 45,632 | 913 | 30.4 |
| 50 | 15,650 | 189,200 | 3,784 | 126.1 |

### Why This Works
- **Level 5 (Transfer Market):** 2.5 months — reasonable anti-bot barrier
- **Level 10 (Clans):** 8.9 months — achievable for dedicated players
- **Level 20:** 30.4 months — veteran milestone
- **Level 50:** 126 months (10.5 years) — lifetime achievement

---

## 2. XP Source Budget

### Daily XP Income (Current Proposal)

| Source | XP/Day | Notes |
|--------|--------|-------|
| League matches (2/day) | 20 | 10 XP per match |
| Daily quests (3) | 15 | 5 XP per quest |
| W2E fitness (5000 steps) | 5 | 1 XP per 1000 steps |
| Social actions (gifts) | 5 | 1 XP per gift |
| PvP friendlies (3/day) | 30 | 10 XP per match |
| **Total possible** | **75** | |
| **Realistic average** | **50** | Assumes 60% activity |

### Problem: PvP XP is TOO GENEROUS

At 30 XP/day from PvP alone, players can reach Level 5 in 75 days (2.5 months) without touching league matches. This undermines the core gameplay loop.

### Recommended PvP XP Cap: **15 XP/day**

| Source | XP/Day (Revised) |
|--------|-------------------|
| League matches | 20 |
| Daily quests | 15 |
| W2E fitness | 5 |
| Social actions | 5 |
| PvP friendlies (capped) | 15 |
| **Total** | **60** |

---

## 3. Level Buff Inflation Analysis (CRITICAL)

### Current Proposal: +1% Match Reward FC per Level

| Level | Buff | Win Reward (Stadium L1) | Net/Day (2 wins) |
|-------|------|-------------------------|-------------------|
| 1 | +1% | 2,010 FC | 1,512 FC |
| 5 | +5% | 2,089 FC | 1,670 FC |
| 10 | +10% | 2,189 FC | 1,870 FC |
| 20 | +20% | 2,388 FC | 2,268 FC |
| 50 | +50% | 2,985 FC | 3,462 FC |

### Problem
At Level 50, a veteran earns **3.4x more FC per match** than a Level 1 player. This creates:
- **Hyperinflation:** Veterans accumulate FC exponentially
- **Pay-to-win perception:** New players can never catch up
- **Bankruptcy mechanics broken:** Veterans never go bankrupt

### Recommended: **Capped Level Buff (+0.5% per level, max +25%)**

| Level | Buff (Revised) | Win Reward |
|-------|----------------|------------|
| 1 | +0.5% | 2,000 FC |
| 10 | +5% | 2,090 FC |
| 25 | +12.5% | 2,239 FC |
| 50 | +25% (capped) | 2,488 FC |

This keeps the bonus meaningful but prevents runaway inflation.

---

## 4. Clan Passive Buff Impact

### Current Proposal: -5% Player Salary

| Team Type | Salary/Match | Salary with Clan | Savings/Day |
|-----------|--------------|------------------|-------------|
| Weak (55 OVR) | 297 FC | 282 FC | 30 FC |
| Mid (70 OVR) | 726 FC | 690 FC | 72 FC |
| Strong (85 OVR) | 1,254 FC | 1,191 FC | 126 FC |

### Break-Even Analysis

| Clan Cost | Daily Savings (Strong) | Break-Even |
|-----------|------------------------|------------|
| 10,000 FC | 126 FC | **79 days** |

### Problem
The -5% salary buff is **extremely powerful** for strong teams. A Level 50 veteran with a Clan saves:
- 126 FC/day from salary reduction
- 1,493 FC/day from Level 50 buff (+50%)
- **Total advantage: +1,619 FC/day over a Level 1 player**

### Recommended: **-3% salary buff, scaled by Clan level**

| Clan Level | Salary Reduction | Break-Even |
|------------|------------------|------------|
| 1 | -2% | 167 days |
| 2 | -3% | 111 days |
| 3 | -5% | 67 days |

This makes clans a long-term investment, not an instant advantage.

---

## 5. Sybil Attack Analysis

### Referral System (1000 FC when friend reaches Level 3)

**Current XP Curve (broken):**
- Days to Level 3: 91 days
- 10 alt accounts × 91 days = 910 account-days
- Total FC: 10,000 FC
- **FC per hour: 22 FC/hour** (unprofitable)

**Revised XP Curve:**
- Days to Level 3: 29 days
- 10 alt accounts × 29 days = 290 account-days
- Total FC: 10,000 FC
- **FC per hour: 86 FC/hour** (marginally profitable)

### Verdict
With the revised XP curve, Sybil attacks become **marginally profitable** but require significant effort (29 days of maintaining 10 accounts). The Level 3 requirement is a reasonable deterrent.

### Additional Safeguards Needed
1. **IP/Device fingerprinting** — Detect multiple accounts from same device
2. **Referral cooldown** — Max 3 referrals per week (not unlimited)
3. **Referral cap** — Max 10 referrals lifetime per player

---

## 6. Daily SP Gifting Abuse

### Current Proposal: 5 SP to 5 friends daily

**Sybil Scenario (10 alts):**
- Each alt sends 5 SP to main = 50 SP/day per alt
- Total SP gain: 500 SP/day
- SP value: ~500 SP × 30 days = 15,000 SP/month

**Legitimate SP Earning:**
- W2E: 2,000 SP/day
- Quests: 25 SP/day
- Total: 2,025 SP/day

**Sybil Boost: +24% SP income**

### Verdict
The gifting system is **moderately abusable**. While SP doesn't directly create FC (it's used for training/healing), the extra SP gives Sybil operators a significant advantage in player development.

### Recommended Safeguards
1. **Relationship age requirement** — Must be friends for 7+ days before gifting
2. **Gift SP cap** — Max 10 SP per friend per day (not 5 SP to 5 friends)
3. **Daily gift limit** — Max 3 gifts per day total (not 5)

---

## 7. PvP Match Engine Impact

### Current State
PvP friendlies use the same `matchEngine.ts` as league matches, but with these differences:
- No stamina drain
- No injuries
- No form/morale impact
- No FC/SP rewards

### Risks

1. **Match Engine Abuse:** Players can test tactics and formations without consequences. This is actually **beneficial** for learning.

2. **XP Farming:** Players can spam PvP for 30 XP/day without playing league matches. This undermines the core loop.

3. **Devaluation of Regular Friendlies:** Current friendlies cost nothing and give FC. PvP gives XP instead. XP is more valuable for progression. **Regular friendlies become obsolete.**

### Recommended: **PvP XP Cap of 15 XP/day**

This forces players to play league matches for the remaining XP, keeping the core loop relevant.

---

## 8. Long-Term Economy Inflation (12-Month Model)

### Assumptions
- 1,000 active players
- Average Level 10 after 9 months
- 50% have Clans
- Referral system injects 2,000,000 FC over 12 months

### Inflation Sources

| Source | Monthly FC Injection | Annual FC Injection |
|--------|---------------------|---------------------|
| Level 10 buff (+10%) | 45,000 FC/player | 540,000 FC/player |
| Clan -5% salary | 3,780 FC/player | 45,360 FC/player |
| Referral rewards | 166,667 FC/player | 2,000,000 FC total |
| Quest inflation (+20%) | 4,650 FC/player | 55,800 FC/player |
| **Total per player** | **~6,000 FC/month** | **~72,000 FC/year** |

### Deflation Sources

| Source | Monthly FC Removal | Annual FC Removal |
|--------|-------------------|-------------------|
| Clan creation | 833 FC/player | 10,000 FC/player |
| Wealth tax (6%) | Variable | ~4,320 FC/player |
| Building upgrades | Variable | ~50,000 FC/player |
| **Total per player** | **~4,500 FC/month** | **~54,000 FC/year** |

### Net Inflation: **+18,000 FC/player/year**

This is **manageable** but requires monitoring. The AI Economy Agent can adjust match_reward_multiplier to compensate.

---

## 9. Recommendations Summary

### Critical Fixes (Must Implement)

| Issue | Current | Recommended |
|-------|---------|-------------|
| XP Curve | `500 × Lvl^1.5` | `200 × Lvl^1.2` |
| Level Buff | +1% per level (uncapped) | +0.5% per level (max +25%) |
| PvP XP | 10 XP per match (uncapped) | 10 XP per match (cap 15/day) |
| Referral Reward | 1000 FC | 500 FC |
| Clan Salary Buff | -5% (flat) | -2% to -5% (scaled by level) |

### Additional Safeguards

| Feature | Safeguard |
|---------|-----------|
| Referrals | Max 3/week, 10 lifetime, 7-day friendship required |
| SP Gifting | Max 10 SP/friend/day, 3 gifts/day total |
| PvP | Daily XP cap of 15, relationship age requirement |
| Clans | Level-gated buffs, creation cost scaled to member count |

---

## 10. Revised Progression Timeline

| Milestone | Current (Broken) | Revised | Notes |
|-----------|------------------|---------|-------|
| Level 2 (Formations) | 39 days | 14 days | Quick unlock for new players |
| Level 3 (Referral reward) | 91 days | 29 days | Reasonable anti-bot barrier |
| Level 5 (Transfer Market) | 283 days (9.4 mo) | 75 days (2.5 mo) | Core feature, must be accessible |
| Level 10 (Clans) | 1,427 days (4 yr) | 267 days (8.9 mo) | Long-term goal, achievable |
| Level 20 | 7,608 days (21 yr) | 913 days (2.5 yr) | Veteran milestone |
| Level 50 | 72,487 days (200 yr) | 3,784 days (10.5 yr) | Lifetime achievement |

---

## Conclusion

The proposed Social Ecosystem has **good intentions** but **dangerous numbers**. The XP curve is 3-4x too steep, the level buffs create hyperinflation, and the referral system is marginally abusable.

**With the recommended changes:**
- XP curve is 3x faster (Level 5 in 2.5 months instead of 9.4)
- Level buffs are capped at +25% (not +50%)
- PvP is capped at 15 XP/day (not unlimited)
- Referrals are limited to 3/week (not unlimited)
- Clan buffs are scaled by level (not flat -5%)

These changes make the Social Ecosystem **engaging without being exploitative**, and keep the game economy **stable over 12+ months**.
