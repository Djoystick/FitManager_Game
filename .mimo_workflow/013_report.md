# Task 013 Report: i18n Sweep Phase 2 — Internal Pages

## Changes Implemented

### 1. New Dictionary Keys Added

**Lineup Page (30 keys):**
| Key | EN | RU |
|-----|----|----|
| `lineup_title` | LINEUP | СОСТАВ |
| `lineup_scout_intel` | Scout Intel | Разведка |
| `lineup_bench_reserves` | Bench & Reserves | Скамейка и Резерв |
| `lineup_lineup_saved` | Lineup Saved | Состав сохранён |
| `lineup_formation_saved` | Formation Saved | Схема сохранена |
| `lineup_heal_count` | Heal ({count}) | Лечить ({count}) |
| `lineup_healed_count` | Healed {count} player(s)! | Вылечено {count} игрок(ов)! |
| `lineup_all_healthy` | All players are already healthy | Все игроки уже здоровы |
| `lineup_data_corruption` | Data Corruption Detected | Обнаружено повреждение данных |
| `lineup_recover_db` | Recover DB (Hard Reset) | Восстановить БД (Hard Reset) |
| `lineup_tax` / `lineup_tax_free` | Tax / Tax Free | Налог / Без налога |
| `lineup_squad_cap` | Squad cap exceeded | Превышен лимит состава |
| `lineup_no_academy` | No Academy Players | Нет игроков в Академии |
| `lineup_scouts_no_intel` | Scouts found no intel | Разведка не нашла данных |
| `lineup_attack/midfield/defense` | ATTACK/MIDFIELD/DEFENSE | АТАКА/ПОЛУЗАЩИТА/ЗАЩИТА |
| + 14 more error/status keys | | |

**Market Page (8 keys):**
| Key | EN | RU |
|-----|----|----|
| `market_transfer_market` | Transfer Market | Трансферный Рынок |
| `market_scout_pool` | Scout Pool | Пул Разведки |
| `market_free_agents` | FREE AGENTS | СВОБОДНЫЕ АГЕНТЫ |
| `market_no_free_agents` | No Free Agents | Нет свободных агентов |
| `market_sign` | SIGN | ПОДПИСАТЬ |
| `market_sign_confirm` | Sign {name} for {price} FC? | Подписать {name} за {price} FC? |
| `market_age` / `market_seasons` | Age {age} / S{count} | Возраст {age} / С{count} |

**Onboarding Page (16 keys):**
| Key | EN | RU |
|-----|----|----|
| `onb_welcome_tagline` | Your club. Your legend. | Твой клуб. Твоя легенда. |
| `onb_welcome_desc` | Web3 football manager... | Web3 симулятор... |
| `onb_create_club` | Create Club | Создать клуб |
| `onb_found_club` | Found Club | Основать клуб |
| `onb_choose_captain` | Choose Your Captain | Выбири капитана |
| `onb_captain_hint` | Your first star will define... | Твоя первая звезда определит... |
| `onb_strategy` | Strategy: | Стратегия: |
| `onb_start_season` | Start Season! | Начать сезон! |
| `onb_gk/def/mid/fwd_strategy` | Build from the back / Hold the line / Control midfield / Focus on attack | Строй от обороны / Держи линию / Контролируй центр / Ставка на атаку |
| + 6 more form/label keys | | |

### 2. Components Updated

**`app/lineup/page.tsx`:**
- All toast messages replaced (save, heal, formation, swap errors)
- Data corruption screen fully localized
- Header labels (Tax, OVR, Heal button)
- Stats grid (General OVR, Squad Size, Formation)
- Squad/Academy tabs with live counts
- Squad cap warning
- Academy empty state
- Scout Intel tab and "no intel" message

**`app/market/page.tsx`:**
- Header title and subtitle
- FREE AGENTS tab label
- Free agent card (Age, SIGN button)
- Free agent buy confirmation/sign toast
- Listing card Age/Seasons labels

**`app/onboarding/page.tsx`:**
- Added LanguageContext + dict imports
- Welcome screen tagline and description
- Create club form (labels, placeholder, button, spinner)
- Captain selection (title, hint, click prompt)
- Strategy ribbon
- Start season button
- POSITION_META strategies moved to dictionary keys

**`app/bank/page.tsx`:**
- Already fully localized via dictionary — no changes needed

### 3. Technical Terms Preserved
- `OVR`, `TON`, `FC`, `SP`, `Sweat Points`, `Tier` remain in English in both languages
- `Hard Reset` kept as-is in the recovery button (technical term)

## Files Modified
- `lib/dictionaries.ts` — 54 new keys in both `en` and `ru`
- `app/lineup/page.tsx` — all hardcoded strings replaced
- `app/market/page.tsx` — all hardcoded strings replaced
- `app/onboarding/page.tsx` — LanguageContext added, all strings localized

## Verification
- `npx tsc --noEmit` passes with zero errors
- All existing dictionary keys preserved
- New keys properly typed in both language sections
