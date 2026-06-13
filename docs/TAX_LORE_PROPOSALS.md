# Tax Lore Proposals — Narrative Wrappers for Economic Sinks

> **Author:** Lead Game Designer (AI)
> **Date:** 2026-06-13
> **Status:** Phase 1 — Design Document
> **Constraint:** No code changes. Proposals only.

---

## Executive Summary

The FitManager economy requires three mandatory FC sinks to maintain the 1.23:1 income/expense ratio identified in the Economy Audit:

| Sink | Rate | Frequency | Example (L5 Stadium, 200K FC balance) |
|------|------|-----------|---------------------------------------|
| Maintenance Tax | 2% × building value × 26 weeks | End of season | ~11,558 FC |
| Wealth Tax | 6% of current FC balance | End of season | ~12,000 FC |
| Tournament Entry Fee | Flat 2,500 FC | Per cup entry | 2,500 FC |

Currently, these are presented as raw deductions with no narrative context. This document proposes four lore-friendly mechanics that transform "punishing deductions" into "engaging gameplay moments."

---

## Mechanic 1: "Club Infrastructure Report" — Season-End Maintenance

### The Problem
Players see a lump-sum deduction at season end labeled "Maintenance Tax." This feels arbitrary and punishing, especially when the player didn't actively "choose" to maintain anything.

### The Proposal
Replace the single tax deduction with a **two-phase seasonal event** that makes maintenance feel like a strategic decision.

#### Phase A: Pre-Season Inspection (Day 1 of new season)
A full-screen modal appears with the header:

```
┌─────────────────────────────────────────────┐
│  🔧 CLUB INFRASTRUCTURE REPORT              │
│  ─────────────────────────────────────────  │
│                                             │
│  Специалисты провели аудит твоей базы.      │
│  Состояние объектов:                        │
│                                             │
│  🏟️ Стадион (Ур. 5)     ████████░░ 80%    │
│  🏥 Медцентр (Ур. 3)    ██████░░░░ 60%    │
│  🎓 Академия (Ур. 4)    ███████░░░ 70%    │
│  🔍 Скаутинг (Ур. 2)   █████░░░░░ 50%    │
│  💺 Трибуны (Ур. 3)     ██████░░░░ 60%    │
│  ☕ Сервисы (Ур. 1)     ███░░░░░░░ 30%    │
│                                             │
│  Общий износ: 58%                           │
│  Стоимость ремонта: 11,558 FC               │
│                                             │
│  ┌──────────────┐  ┌──────────────────┐    │
│  │ Провести     │  │ Отложить ремонт  │    │
│  │ ремонт       │  │ (-20% доходности)│    │
│  └──────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────┘
```

#### Phase B: Consequences
- **If player pays:** Buildings remain at full effectiveness. A satisfying "repair complete" animation plays. Player sees "+0% maintenance applied" as a positive confirmation.
- **If player defers:** A red warning badge appears on the base screen: "⚠️ Износ объектов: -20% к доходу от билетов." The penalty is visually tied to a visible status, not a hidden deduction.

#### Psychological Justification
- **Loss Aversion Framing:** The player isn't "losing" FC — they're "choosing" to protect their income. The deferred option creates a clear tradeoff, making the payment feel like a strategic decision rather than a tax.
- **Visible State:** Each building shows a durability bar, making the cost feel proportional and fair. A Level 5 stadium *should* cost more to maintain than a Level 1 academy.
- **Agency Illusion:** Even though the math is identical (2% × building value × 26 weeks), the player feels they made a choice.

#### Implementation Notes
- The "defer" option applies a -20% ticket revenue modifier for the next season (equivalent to ~2% annual loss, matching the tax rate).
- Buildings don't actually degrade — this is purely cosmetic framing.
- The inspection modal should use the existing `glass-card` styling with amber/orange accents (maintenance theme).

---

## Mechanic 2: "Board of Directors Dividends" — Wealth Tax

### The Problem
A 6% wealth tax on FC balance is the largest single deduction for wealthy players. "Wealth Tax" sounds like a government penalty, not a game mechanic.

### The Proposal
Frame the wealth tax as **Board Dividends** — the club's fictional ownership group takes a percentage of profits as their annual dividend. This is narratively consistent (real football clubs have shareholders) and psychologically palatable (dividends imply the club is *successful*).

#### UI: Season-End Telegram Message
Replace the current generic deduction with a narrative message:

```
🏛️ *ОТЧЁТ СОВЕТА ДИРЕКТОРОВ*

Совет директоров *${teamName}* утвердил годовой отчёт.

📊 Финансовые показатели сезона:
• Общий доход: +${totalIncome} FC
• Чистая прибыль: +${netProfit} FC
• Рост капитала: +${growthPct}%

💰 Распределение прибыли:
• Совет директоров (дивиденды): *-${wealthTax} FC*
• Резервный фонд клуба: *+${reserveAmount} FC*

📈 Текущий капитал клуба: *${newBalance} FC*

_«Успешный клуб — прибыльный клуб. Директора благодарны 
за стабильный рост и táiинвестируют часть прибыли 
в развитие инфраструктуры.\"_
```

#### UI: In-Game Notification (Optional Enhancement)
A small "dividend receipt" card appears in the journal/activity feed:

```
┌────────────────────────────────────┐
│ 📋 Дивиденды Совета Директоров     │
│ ─────────────────────────────────  │
│ Сезон: #14  |  Tier 3             │
│ Чистая прибыль: +45,200 FC        │
│ Дивиденды (6%): -2,712 FC         │
│ Резервный фонд: +500 FC           │
│ ─────────────────────────────────  │
│ Капитал клуба: 42,488 FC          │
└────────────────────────────────────┘
```

#### Psychological Justification
- **Status Signal:** Dividends imply the club is profitable. A wealthy player seeing "Board Dividends: -12,000 FC" subconsciously registers "my club is so rich that the board is taking profits" — this is a *badge of honor*, not a punishment.
- **Reframing Loss as Success:** The message explicitly shows "Net Profit: +XX,XXX FC" before the deduction. The player sees the deduction as a small fraction of their success, not an isolated penalty.
- **Reserve Fund Justification:** A small portion (e.g., 500 FC flat) is added to a "Reserve Fund" — a cosmetic counter that shows the club's financial health. This creates the illusion that some money is "staying" with the club.
- **Narrative Consistency:** Real football clubs have ownership structures, board meetings, and profit distributions. This mechanic deepens the simulation.

#### Implementation Notes
- The wealth tax math remains identical: `Math.floor(currentBalance * 0.06)`.
- The "Reserve Fund" is purely cosmetic — it doesn't affect gameplay.
- The Telegram message should replace the current generic season-end message for wealthy players (balance > 10,000 FC). Poorer players see the standard message.

---

## Mechanic 3: "Cup Tournament Logistics" — Entry Fee

### The Problem
The 2,500 FC tournament fee is displayed as a raw number in the tournament bracket UI. Players see "Entry Fee: 2,500 FC" and think "pay-to-play."

### The Proposal
Transform the fee into a **narrative logistics package** that feels like a natural part of tournament participation.

#### UI: Tournament Join Flow
Replace the current "Entry Fee: 2,500 FC" label with a detailed breakdown:

```
┌─────────────────────────────────────────────┐
│  🏆 КУБОК ВЫЗОВА — РЕГИСТРАЦИЯ              │
│  ─────────────────────────────────────────  │
│                                             │
│  Для участия в турнире необходима оплата    │
│  логистики:                                 │
│                                             │
│  ✈️ Перелёт команды:           800 FC      │
│  🏨 Проживание (3 матча):      600 FC      │
│  🛡️ Страхование игроков:       400 FC      │
│  📋 Турнирная пошлина:          700 FC      │
│  ─────────────────────────────────────────  │
│  ИТОГО:                       2,500 FC      │
│                                             │
│  💡 Совет: Улучши Трибуны для получения     │
│     спонсорских бонусов, покрывающих        │
│     расходы на турниры.                     │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │     Зарегистрироваться               │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

#### UI: Post-Join Confirmation
After successful registration, show a brief "packing" animation:

```
✈️ Команда готовится к вылету...
✅ Билеты куплены
✅ Отель забронирован  
✅ Страховка оформлена
✅ Регистрация подтверждена

Удачи в турнире! 🏆
```

#### Psychological Justification
- **Itemized Value:** Breaking 2,500 FC into 4 visible line items makes the cost feel justified. Each item has a real-world analog (flights, hotels, insurance), making the fee feel like a *service*, not a *tax*.
- **Anticipation Building:** The "packing" animation creates excitement before the tournament, reframing the fee as the start of an adventure rather than a transaction.
- **Upsell Hint:** The tip about upgrading Tribunes for sponsor bonuses plants a seed for future investment, connecting the fee to the upgrade loop.
- **Sunk Cost Engagement:** Once players "pay for flights and hotels," they're psychologically more invested in winning the tournament (sunk cost fallacy), which increases engagement.

#### Implementation Notes
- The 2,500 FC is split into fixed cosmetic categories (doesn't need to be mathematically accurate — it's flavor).
- The "packing" animation is a 2-second sequence of checkmarks appearing.
- The sponsor bonus tip only appears if the player's Seating Level is < 5.

---

## Mechanic 4: "Seasonal Sponsorship Contract" — Combined Maintenance + Wealth Tax

### Alternative Proposal
Instead of two separate deductions (maintenance + wealth), combine them into a single **Sponsorship Contract renewal** at season start. This is an alternative to Mechanics 1+2 and may be simpler to implement.

#### Concept
At the start of each season, the club's main sponsor offers a renewal contract. The contract includes:
- A base payment TO the club (e.g., +5,000 FC)
- An obligation to maintain infrastructure (the maintenance cost)
- A profit-sharing clause (the wealth tax)

#### UI: Season-Start Modal

```
┌─────────────────────────────────────────────┐
│  📝 КОНТРАКТ СО СПОНСОРОМ                   │
│  ─────────────────────────────────────────  │
│                                             │
│  FitBank предлагает продление спонсорского  │
│  контракта на Season #{n+1}:                │
│                                             │
│  💰 Аванс:                    +5,000 FC     │
│  🔧 Обязательства по базе:   -{maint} FC   │
│  📊 Доля от прибыли (6%):     -{wealth} FC  │
│  ─────────────────────────────────────────  │
│  Чистый эффект:               {net} FC      │
│                                             │
│  Контракт действителен на весь сезон.       │
│  Невыполнение обязательств = штраф 20%      │
│  к доходу от билетов.                       │
│                                             │
│  ┌──────────────────┐  ┌────────────────┐  │
│  │ Подписать         │  │ Отклонить      │  │
│  │ контракт          │  │ (нет аванса)   │  │
│  └──────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────┘
```

#### Psychological Justification
- **Net-Positive Framing:** The contract shows a positive "advance" payment first, making the deductions feel like they're being partially covered. Even if the net effect is negative, the player remembers the "+5,000 FC" visually.
- **Commitment Device:** Signing a contract feels like a proactive choice, not a被动 deduction. The "reject" option creates a meaningful decision.
- **Narrative Stakes:** The "penalty for non-compliance" ties back to the maintenance mechanic (Mechanic 1), creating a cohesive economic narrative.

#### Implementation Notes
- This replaces both maintenance and wealth tax with a single contract event.
- The advance payment reduces the effective tax rate slightly (e.g., +5,000 FC offset means the net deduction is ~17,500 instead of ~23,500 for a wealthy player).
- This is the **recommended approach** for players with > 50,000 FC, as it simplifies the end-of-season flow.

---

## Comparative Analysis

| Mechanic | Affects | Psychological Frame | Complexity | Recommendation |
|----------|---------|-------------------|------------|----------------|
| 1. Infrastructure Report | Maintenance Tax | Strategic Choice | Medium | ✅ Implement (all players) |
| 2. Board Dividends | Wealth Tax | Status/Badge of Honor | Low | ✅ Implement (all players) |
| 3. Cup Logistics | Entry Fee | Adventure/Preparation | Low | ✅ Implement (all tournaments) |
| 4. Sponsorship Contract | Both Taxes | Contract/Commitment | High | ⚡ Optional (wealthy players only) |

### Recommended Implementation Order
1. **Mechanic 3 (Cup Logistics)** — Easiest, highest impact on new players
2. **Mechanic 2 (Board Dividends)** — Low complexity, reframes the most painful deduction
3. **Mechanic 1 (Infrastructure Report)** — Highest complexity but most immersive
4. **Mechanic 4 (Sponsorship Contract)** — Optional enhancement for endgame players

---

## Anti-Patterns to Avoid

1. **"Fine Print" Traps:** Never hide the actual deduction behind confusing UI. The player should always be able to see the exact FC amount they're paying. Transparency builds trust.

2. **Punitive Language:** Never use words like "штраф" (penalty), "взыскание" (levy), "обязанность" (obligation) in isolation. Always pair them with positive framing: "Вклад в развитие" (Contribution to development), "Инвестиция в будущее" (Investment in the future).

3. **Fake Choices:** If the "reject" option is always worse, don't present it as a choice. Either make both options viable or remove the choice entirely. Players see through fake agency.

4. **Inconsistent Messaging:** If the Telegram message says "Board Dividends" but the in-game tooltip says "Wealth Tax," players will feel deceived. All touchpoints must use the same narrative language.

5. **Excessive Animation:** The "packing" animation for tournaments should be < 2 seconds. Long animations on routine actions cause friction.

---

## Glossary (Russian Terms for Localization)

| English | Russian | Context |
|---------|---------|---------|
| Board of Directors | Совет Директоров | Wealth tax framing |
| Dividends | Дивиденды | Seasonal payout deduction |
| Infrastructure Report | Отчёт по инфраструктуре | Maintenance tax framing |
| Tournament Logistics | Логистика турнира | Entry fee framing |
| Sponsorship Contract | Спонсорский контракт | Combined tax alternative |
| Wear & Tear | Износ | Building durability metaphor |
| Reserve Fund | Резервный фонд | Cosmetic FC counter |
| Net Profit | Чистая прибыль | Positive framing for deductions |

---

## Next Steps

1. **Playtest Script:** Create a 5-minute playtest script that walks a new player through one full season, highlighting each tax moment. Measure emotional response at each touchpoint.

2. **A/B Test Plan:** Test "Board Dividends" vs "Wealth Tax" label on 100 active players. Measure:
   - Ticket revenue (proxy for player engagement)
   - Session length after season end
   - Negative feedback messages

3. **Localization Pack:** Prepare Russian + English text for all modal headers, button labels, and tooltip strings.

4. **Animation Specs:** Create After Effects mockups for:
   - Infrastructure inspection animation (5 seconds)
   - Cup logistics "packing" sequence (2 seconds)
   - Board Dividends "receipt" slide-in (1.5 seconds)

---

*This document is a design proposal only. No game code has been modified.*
