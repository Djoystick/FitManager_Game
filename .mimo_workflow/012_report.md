# Task 012 Report: i18n Sweep — Dashboard & Modals

## Changes Implemented

### 1. New Dictionary Keys Added

**English (`en`):**
| Key | Value |
|-----|-------|
| `standings_title` | League Standings |
| `standings_empty` | No standings data yet |
| `standings_you` | YOU |
| `standings_pts` | pts |
| `standings_your_position` | Your Position |
| `standings_your_team` | Your Team |
| `standings_full` | Full Standings |
| `match_vs` | vs |
| `match_round` | R{round} |
| `waiting_for_teams` | WAITING FOR TEAMS |
| `lobby_teams_count` | {count} / 14 |
| `fancoin_label` | FanCoin (FC) |
| `stat_ovr` | OVR |
| `stat_sta` | STA |
| `stat_lvl` | LVL |
| `win_short` | W |
| `draw_short` | D |
| `loss_short` | L |
| `unknown_team` | Unknown |

**Russian (`ru`):**
| Key | Value |
|-----|-------|
| `standings_title` | Таблица Лиги |
| `standings_empty` | Данных пока нет |
| `standings_you` | ВЫ |
| `standings_pts` | очк |
| `standings_your_position` | Ваша позиция |
| `standings_your_team` | Ваша команда |
| `standings_full` | Полная таблица |
| `match_vs` | против |
| `match_round` | Т{round} |
| `waiting_for_teams` | ОЖИДАНИЕ КОМАНД |
| `lobby_teams_count` | {count} / 14 |
| `fancoin_label` | FanCoin (FC) |
| `stat_ovr` | OVR |
| `stat_sta` | STA |
| `stat_lvl` | LVL |
| `win_short` | В |
| `draw_short` | Н |
| `loss_short` | П |
| `unknown_team` | Неизвестно |

### 2. Components Updated

**`StandingsModal`:**
- Added `t` prop parameter
- Replaced: `League Standings`, `No standings data yet`, `YOU`, `pts`, `Your Position`, `Your Team`, `Full Standings`, `Unknown`, `W/D/L`

**`MatchCard`:**
- Added `t` prop parameter
- Replaced: `vs`, `R{round}`

**`CalendarMatchRow`:**
- Already had `t` prop
- Replaced: `R{round}` badge

**`DashboardPage` (main):**
- Replaced: `WAITING FOR TEAMS`, `{count} / 14`, `FanCoin (FC)`, `No matches yet`
- `vs` and `R{round}` in proceed button

### 3. Technical Terms Preserved
Per the critical rule, the following remain in English in both languages:
- `OVR`, `STA`, `LVL` — stat abbreviations
- `FanCoin`, `FC`, `SP`, `TON`, `Tier` — game currency/system terms

## Files Modified
- `lib/dictionaries.ts` — 19 new keys in both `en` and `ru`
- `app/page.tsx` — all hardcoded strings replaced with dictionary references

## Verification
- `npx tsc --noEmit` passes with zero errors
- All existing dictionary keys preserved
- New keys properly typed in both language sections
