# Match Engine Mathematics & Mechanics

## 1. OVR Aggregation & RNG Luck Factor
To ensure matches aren't purely deterministic (i.e., highest OVR always wins), the Match Engine injects a Random Number Generator (RNG) variable called the "Luck Factor."

- **Baseline Power:** The engine queries `public.players` to calculate `SUM(ovr)` specifically for the 11 players marked with `lineup_status = 'starting'` for both teams.
- **Luck Multiplier:** A dynamic multiplier between `0.85x` and `1.15x` is generated for each team independently:
  `luck_multiplier := 0.85 + (random() * 0.30);`
- **Final Power:** The team's `SUM(ovr)` is multiplied by their `luck_multiplier` to establish `final_power`.

## 2. Match Resolution & Scoring
Rather than abstracting the result, the engine maps the power variance directly into realistic football scores:
1. **Base Goals:** Every team has a randomized base goal count of `0` or `1` goal.
2. **Advantage Mapping:** 
   - If a team's `final_power` exceeds their opponent's by **5%** (`> 1.05x`), they gain an extra `1-2` goals.
   - If the power dominance exceeds **20%** (`> 1.20x`), they are granted an additional `1-2` goals, reflecting a decisive tactical outplay.

## 3. Atomic Stamina Depletion
Football manager games require a currency sink to encourage rotational squad depth or microtransactions (such as Medical Center TP expenditure).
- During the `conduct_match` RPC, immediately following the match update, the engine calculates a `drain_amount`.
- **Drain Formula:** `15 + FLOOR(random() * 6)` (Resulting in 15 to 20 points drained).
- **Execution:** An atomic `UPDATE` hits the `players` table, subtracting the `drain_amount` exclusively from the 22 players who participated as `starting`. Players on the `bench` do not lose stamina.
- The `GREATEST(0, stamina - drain_amount)` constraint ensures stamina never breaks below 0.
