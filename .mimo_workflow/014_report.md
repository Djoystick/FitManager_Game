# Task 014 Report: i18n Phase 3 — Components & Modals

## Changes Implemented

### 1. New Dictionary Keys Added

**MatchReportModal (8 keys):**
| Key | EN | RU |
|-----|----|----|
| `report_draw` | DRAW | НИЧЬЯ |
| `report_victory` | VICTORY | ПОБЕДА |
| `report_defeat` | DEFEAT | ПОРАЖЕНИЕ |
| `report_match_events` | Match Events | События матча |
| `report_no_events` | No significant events | Нет значимых событий |
| `report_stamina_drain` | Squad Stamina Drain: ~20% | Потеря стамины состава: ~20% |
| `report_processing` | Processing... | Обработка... |
| `report_accept` | Accept Report | Принять отчёт |

**OpponentScoutModal (10 keys):**
| Key | EN | RU |
|-----|----|----|
| `scout_report` | SCOUT REPORT | ОТЧЁТ РАЗВЕДКИ |
| `scout_gathering` | Gathering Intel... | Сбор данных... |
| `scout_no_data` | No data available | Нет данных |
| `scout_est_power` | Est. Power | Оц. мощь |
| `scout_intel_quality` | Intel Quality | Качество разведки |
| `scout_quality_high/medium/low` | HIGH/MEDIUM/LOW | ВЫСОКОЕ/СРЕДНЕЕ/НИЗКОЕ |
| `scout_detected_lineup` | Detected Lineup | Обнаруженный состав |
| `scout_upgrade_facility` | Upgrade Scouting Facility... | Улучшите Разведку... |

**UnseenMatchesModal (10 keys):**
| Key | EN | RU |
|-----|----|----|
| `unseen_single_title` | Матч завершен! | Матч завершен! |
| `unseen_multi_title` | Непросмотренные матчи | Непросмотренные матчи |
| `unseen_vs` | VS | ПРОТИВ |
| `unseen_win/loss/draw` | Победа/Поражение/Ничья | Победа/Поражение/Ничья |
| `unseen_view_stats` | Посмотреть статистику | Посмотреть статистику |
| `unseen_count_msg` | Пока вас не было... | Пока вас не было... |
| `unseen_accept_single/multi` | Принять / Отметить все... | Принять / Отметить все... |

**LandingPage (16 keys):**
| Key | EN | RU |
|-----|----|----|
| `landing_title` | FitManager Game | FitManager Game |
| `landing_subtitle` | A next-generation... | Telegram Mini App нового поколения... |
| `landing_purpose_title/desc` | Purpose of the Application / description | Назначение приложения / описание |
| `landing_google_fit_title/desc` | How we use Google Fit Data / description | Как мы используем данные Google Fit / описание |
| `landing_gf_bullet1-4` | 4 bullet points about data usage | 4 пункта об использовании данных |
| `landing_play_btn` | Play in Telegram | Играть в Telegram |
| `landing_privacy/terms` | Privacy Policy / Terms of Service | Политика конфиденциальности / Условия использования |
| `landing_copyright` | © {year} FitManager Game... | © {year} FitManager Game... |

**OffseasonCard (8 keys):**
| Key | EN | RU |
|-----|----|----|
| `season_ended` | SEASON ENDED | СЕЗОН ЗАВЕРШЕН |
| `season_champion` | CHAMPION! | ЧЕМПИОН! |
| `season_promoted` | PROMOTED | ПОВЫШЕНИЕ В КЛАССЕ |
| `season_relegated` | RELEGATED | ПОНИЖЕНИЕ |
| `season_prev_league` | Previous League | Предыдущая лига |
| `season_pts` | PTS | ОЧК |
| `season_started` | Season started | Сезон начался |
| `season_transfer_window` | TRANSFER WINDOW | ТРАНСФЕРНОЕ ОКНО |

**SocialFeed (2 keys):**
| Key | EN | RU |
|-----|----|----|
| `feed_news` | News Feed | Лента новостей |
| `feed_read_more` | Читать полностью | Читать полностью |

### 2. Components Updated

**`components/MatchReportModal.tsx`:**
- Added LanguageContext + dict imports
- Replaced: DRAW/VICTORY/DEFEAT, Match Events, No significant events, Stamina Drain, Processing/Accept Report

**`components/OpponentScoutModal.tsx`:**
- Added LanguageContext + dict imports
- Replaced: SCOUT REPORT, Gathering Intel, Est. Power, Intel Quality, HIGH/MEDIUM/LOW, Detected Lineup, Upgrade message

**`components/UnseenMatchesModal.tsx`:**
- Added LanguageContext + dict imports
- Replaced: titles, VS, result labels, view stats, count message, accept buttons

**`components/LandingPage.tsx`:**
- Added LanguageContext + dict imports
- Replaced: title, subtitle, Purpose section, Google Fit section (4 bullets), Play button, Privacy/Terms links, copyright

**`components/dashboard/OffseasonCard.tsx`:**
- Added dict import
- Replaced all 8 manual `language === 'ru' ? ... : ...` ternaries with dictionary references

**`components/dashboard/SocialFeed.tsx`:**
- Added LanguageContext + dict imports
- Replaced: News Feed, Читать полностью

### 3. Technical Terms Preserved
- `OVR`, `TON`, `FC`, `SP`, `Sweat Points`, `Tier` remain in English in both languages
- `Google Fit`, `Google Fitness API` kept as-is (brand names)

## Files Modified
- `lib/dictionaries.ts` — 54 new keys in both `en` and `ru`
- `components/MatchReportModal.tsx` — all hardcoded strings replaced
- `components/OpponentScoutModal.tsx` — all hardcoded strings replaced
- `components/UnseenMatchesModal.tsx` — all hardcoded strings replaced
- `components/LandingPage.tsx` — all hardcoded strings replaced
- `components/dashboard/OffseasonCard.tsx` — manual language checks replaced with dict
- `components/dashboard/SocialFeed.tsx` — hardcoded strings replaced

## Verification
- `npx tsc --noEmit` passes with zero errors
- All existing dictionary keys preserved
- New keys properly typed in both language sections
- OffseasonCard now uses dictionary instead of inline ternaries
