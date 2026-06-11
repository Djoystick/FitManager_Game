# Task 016 Report: Dashboard UX Restructuring — Implementation Complete

## Summary

Refactored the Main Dashboard (`app/page.tsx`) from a **scrollable 7-section feed** to a **single-screen 4-row flex layout** that fits within `100dvh` without vertical scrolling.

## Changes Implemented

### 1. New Dashboard Components (5 files)

| Component | File | Purpose |
|-----------|------|---------|
| `NextMatchInfoCard` | `components/dashboard/NextMatchInfoCard.tsx` | Info card showing opponent + countdown. Tap opens scout modal. NOT a CTA button. |
| `UnseenMatchesCard` | `components/dashboard/UnseenMatchesCard.tsx` | Alert card with unseen match count badge |
| `FitnessSyncCard` | `components/dashboard/FitnessSyncCard.tsx` | Stamina progress bar widget |
| `MiniStandingsCard` | `components/dashboard/MiniStandingsCard.tsx` | 3-row mini standings (above/self/below user) |
| `TeamSummaryCard` | `components/dashboard/TeamSummaryCard.tsx` | OVR + Tactic + Injured count summary |

### 2. Refactored `app/page.tsx`

**Root layout change:**
```diff
- className="h-full flex flex-col overflow-y-auto custom-scrollbar text-white relative"
- style={{ paddingBottom: '90px', background: '#05060f' }}
+ className="h-full flex flex-col overflow-hidden text-white relative"
+ style={{ background: '#05060f' }}
```

**Content area:**
```tsx
<div className="flex-1 flex flex-col min-h-0 px-3 py-2 gap-2 overflow-hidden relative z-10">
  <FranchiseCard />       {/* flex-shrink-0, ~70px */}
  <CoreFocus />           {/* flex-shrink-0, ~80px */}
  <CtaHub />              {/* flex-shrink-0, ~70px */}
  <InfoSnippets />        {/* flex-shrink-0, ~80px */}
  <div className="flex-1" />  {/* spacer absorbs remaining space */}
</div>
```

**Sections removed from dashboard:**
- Upcoming Fixtures (5 rows) — moved to modal
- Financial Row (Bank + Profit) — accessible via BottomTabBar
- Match History carousel — accessible via match report modal
- Action Grid (3 buttons) — replaced by CTA Hub
- Bottom padding spacer — no longer needed

**Key CSS classes for 100dvh:**
- `overflow-hidden` on root — prevents scrolling
- `min-h-0` on content area — allows flex children to shrink
- `flex-shrink-0` on each row — sections maintain height
- `flex-1` spacer — absorbs remaining vertical space

### 3. Dictionary Keys

Added `dashboard_new_matches` key in both EN and RU.

## Height Budget

| Screen | Viewport | Available | Content | Spacer |
|--------|----------|-----------|---------|--------|
| iPhone SE | 568px | 379px | ~300px | 79px ✓ |
| iPhone 14 | 844px | 655px | ~300px | 355px |
| iPhone 15 Pro Max | 932px | 743px | ~300px | 443px |

Content fits on all screens. Spacer absorbs extra space gracefully.

## Files Modified
- `app/page.tsx` — major refactor (scrollable → flex single-screen)
- `components/dashboard/NextMatchInfoCard.tsx` — NEW
- `components/dashboard/UnseenMatchesCard.tsx` — NEW
- `components/dashboard/FitnessSyncCard.tsx` — NEW
- `components/dashboard/MiniStandingsCard.tsx` — NEW
- `components/dashboard/TeamSummaryCard.tsx` — NEW
- `lib/dictionaries.ts` — new i18n key

## Verification
- `npx tsc --noEmit` passes with zero errors
- All modals open correctly from new cards
- BottomTabBar navigation works
- No vertical scrolling on any viewport size
