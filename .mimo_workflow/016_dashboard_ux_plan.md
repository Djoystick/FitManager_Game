# Task 016: Dashboard UX Restructuring (Plan Mode)

## Context
You are supervised by the Senior Architect. We need to restructure the Main Dashboard (`app/page.tsx` and related components in `components/dashboard/`) to achieve the perfect "Single-Screen Web3 TMA UX".

Currently, the Dashboard might be cluttered or require vertical scrolling. The Senior Architect has established a strict constraint: **The Main Dashboard must fit entirely within one screen (`100dvh`) without vertical scrolling.**

## Objective
Your goal is to analyze the existing Dashboard layout, identify UX bottlenecks, and propose a highly ergonomic, single-screen structure. 

### UX Principles to Enforce:
1. **Header (Top Bar):** Avatar, Level, and the 3 Balances (TON, FanCoins, Sweat Points) must be instantly visible and sticky.
2. **Core Focus (Center):** The next upcoming match countdown and opponent. Should include a prominent "Scout" button.
3. **Calls to Action (CTA Hub):** Alerts for unseen matches (Match Journal), and the Sweat Bank / Fitness Sync progress bar.
4. **Information Snippets (Secondary):** Two widgets side-by-side: A mini league standings table (just 3 rows: above, self, below) and a Team Summary (OVR, Tactic, Health status).
5. **Bottom Tab Bar:** Global navigation.

## Instructions for MiMo
Since you are operating in **Plan Mode**, DO NOT modify any code.
1. Read `app/page.tsx`, `components/dashboard/*`, and `components/ui/BottomTabBar.tsx`.
2. Evaluate which existing components need to be shrunk, hidden, redesigned, or moved to modals to fit the `100dvh` rule.
3. Write a comprehensive UX/UI restructuring plan to `.mimo_workflow/016_report.md`.
4. Your report must include the proposed React component tree and the Tailwind CSS layout strategy (e.g., using `flex-1`, `overflow-hidden`, grids) to achieve the layout.
