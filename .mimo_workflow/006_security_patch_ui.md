# Task 006: Security Patch - Phase 6 (UI, Config & Tailwind)

## Context
You are supervised by the Senior Architect. This is the final phase of the audit fixes. We are cleaning up configuration conflicts and broken UI animations.

## STRICT RULES OF ENGAGEMENT
1. You **ARE ALLOWED** to run terminal commands to install npm packages for this task.
2. You **ARE ALLOWED** to modify UI components and CSS files listed below.

## Tasks
Your goal is to fix bugs C21, C22, and C25.

### 1. Missing Animations Plugin (C22)
**Bug**: The UI uses `animate-in`, `fade-in`, etc., but the `tailwindcss-animate` plugin is missing.
**Fix**: 
- Run `npm install tailwindcss-animate` in the terminal.
- Add it to the `plugins` array in `tailwind.config.ts`: `plugins: [require("tailwindcss-animate")],`

### 2. Tailwind Syntax Conflict (C21)
**File**: `app/globals.css`
**Bug**: The file mixes v4 syntax (`@import "tailwindcss";`) with v3 syntax (`@tailwind base;`).
**Fix**: Since `tailwindcss-animate` typically relies on v3, remove the v4 `@import "tailwindcss";` line and ensure only the three `@tailwind` directives remain.

### 3. Unreachable TMA Breakpoints (C25)
**Files**:
- `components/squad/SquadManager.tsx`
- `components/league/NextOpponentCard.tsx`
**Bug**: The Telegram Mini App viewport is capped at 480px. Standard Tailwind breakpoints like `sm:` (640px) and `md:` (768px) will never trigger.
**Fix**: Replace instances of `sm:` and `md:` in these files with custom arbitrary breakpoints that make sense for mobile, such as `min-[400px]:` or `min-[440px]:`.

## Output
When finished, write a short summary of your fixes in `.mimo_workflow/006_report.md`.
