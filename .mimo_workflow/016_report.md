# Task 016 Report: Dashboard UX Restructuring Plan

## Executive Summary

The current Dashboard (`app/page.tsx`, 1105 lines) is a **scrollable feed** with 7 sections totaling ~800-1050px of content. On a typical iPhone viewport (568-812px), after subtracting the GlobalHeader (~125px) and BottomTabBar (~64px), only ~379-623px is available. **Content exceeds viewport by 170-430px**, requiring vertical scrolling — violating the 100dvh single-screen TMA UX constraint.

## Root Cause

The page root uses `overflow-y-auto custom-scrollbar`, treating the dashboard as an infinitely scrollable feed. Combined with 7 stacked sections (Franchise Card, Countdown, 5-row Fixtures, Financial Row, Action Grid, Match History, padding), the content naturally exceeds any mobile viewport.

## Proposed Architecture

Replace the scrollable feed with a **flex-column, overflow-hidden container** where each section gets a fixed or flex-allocated height. Four compact rows + a spacer absorb all remaining space.

### New Section Layout

| Row | Content | Height | What Changed |
|-----|---------|--------|-------------|
| 1 | Franchise Card (compact) | ~70px | Removed OVR bar, tighter padding, smaller logo |
| 2 | Core Focus (next match info + countdown) | ~80px | **Info Card**, not CTA — tap opens scout modal |
| 3 | CTA Hub (unseen matches + fitness) | ~70px | New 2-col: alert card + progress bar |
| 4 | Info Snippets (mini standings + team summary) | ~80px | New 2-col: 3-row standings + OVR/Tactic/Health |
| Spacer | `flex-1` absorbs remaining space | varies | Fills to bottom naturally |

### What Moves to Modals

- **Upcoming Fixtures (5 rows)** → New modal, opened from Core Focus card
- **Financial Row** → Removed (accessible via BottomTabBar HUB tab)
- **Match History carousel** → Removed (accessible via match report modal)
- **Action Grid (3 buttons)** → Replaced by CTA Hub

### Height Budget

| Screen | Viewport | Available | Content | Spacer |
|--------|----------|-----------|---------|--------|
| iPhone SE | 568px | 379px | 300px | 79px ✓ |
| iPhone 14 | 844px | 655px | 300px | 355px |
| iPhone 15 Pro Max | 932px | 743px | 300px | 443px |

Content fits on all screens. Spacer absorbs extra space gracefully.

### New Components Required

1. `UpcomingFixturesModal.tsx` — full fixture list (bottom sheet)
2. `MiniStandingsCard.tsx` — 3-row mini standings (above/self/below)
3. `TeamSummaryCard.tsx` — OVR + Tactic + Health status
4. `FitnessSyncCard.tsx` — progress bar widget
5. `UnseenMatchesCard.tsx` — alert card with unseen match count

### CSS Strategy

```tsx
// Root: no scroll
<div className="h-full flex flex-col overflow-hidden text-white">
  <GlobalHeader />
  <div className="flex-1 flex flex-col min-h-0 px-3 py-2 gap-2 overflow-hidden">
    <FranchiseCard />       {/* flex-shrink-0 */}
    <CoreFocus />           {/* flex-shrink-0 */}
    <CtaHub />              {/* flex-shrink-0 */}
    <InfoSnippets />        {/* flex-shrink-0 */}
    <div className="flex-1" />  {/* spacer */}
  </div>
  <BottomTabBar />
</div>
```

### Files to Modify

1. `app/page.tsx` — major refactor (scrollable → flex single-screen)
2. `components/dashboard/UpcomingFixturesModal.tsx` — NEW
3. `components/dashboard/MiniStandingsCard.tsx` — NEW
4. `components/dashboard/TeamSummaryCard.tsx` — NEW
5. `components/dashboard/FitnessSyncCard.tsx` — NEW
6. `components/dashboard/UnseenMatchesCard.tsx` — NEW
7. `lib/dictionaries.ts` — new i18n keys

### Verification

1. iPhone SE (568px) — fits without scroll ✓
2. iPhone 15 Pro Max (932px) — spacer fills extra space ✓
3. All modals open correctly from new cards ✓
4. BottomTabBar navigation works ✓
5. `npx tsc --noEmit` passes ✓
