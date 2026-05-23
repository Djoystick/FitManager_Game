# Phase 9: P2P Transfer Market Logic

## Overview
Phase 9 establishes the structural groundwork for the decentralized "FitManager_Game" Web3 economy. We have introduced the foundational Transfer Market layer, empowering managers to list their players for sale natively via TON. To combat market spam and enforce strict economy balancing, an "Agency License" system burns the soft-currency (`balance_fancoins`) for every confirmed listing.

## 1. Database Schema Updates (`supabase/migrations/00003_create_transfer_market.sql`)
A new relational table was engineered to securely manage asynchronous market states:
- **`transfer_market`**:
  - `player_id` (Cascading reference binding to the `players` table).
  - `seller_id` (Cascading reference binding to the `users` table).
  - `price_ton`: Architected as `NUMERIC(10, 4)` to accurately support granular blockchain denomination precision.
  - `is_active`: Boolean flag defaulting to `true`.
- **Constraint Mechanism**: Implemented a partial unique index (`CREATE UNIQUE INDEX ... WHERE is_active = true`). This physically prevents the database from ever accepting duplicate concurrent listings for the identical player, stopping UI exploits.

## 2. Market Listing API (`app/api/market/list/route.ts`)
A strictly typed `POST` endpoint was deployed. It enacts an impenetrable validation sequence before executing a simulated database transaction.

### Validation Sequence
1. **Payload Verification**: Ensures `userId`, `playerId`, and a mathematically valid `priceTon` > 0 are provided.
2. **Ownership Auditing**: Queries the `players` table to extract the `team_id`, then dynamically cross-references the `teams` table to definitively prove the requester owns the franchise holding the player.
3. **Spam Defense**: Issues a pre-flight query to `transfer_market` ensuring no active listings collide with the payload.
4. **Economic Burn Mechanism**: Audits the user's real-time `balance_fancoins`. The endpoint violently rejects with a `400 Bad Request` if they possess fewer than the fixed static threshold (`LISTING_FEE_FANCOINS = 100`).

### Simulated Transaction Flow
Since traditional ACID SQL transactions are heavily restricted on frontend-facing clients without custom Postgres RPCs, the route manages atomic consistency manually:
1. It preemptively deducts the 100 FanCoins directly from the `users` table.
2. It attempts to `INSERT` the complex market listing.
3. **Rollback Safety Protocol**: If the market insertion fails (e.g., catching a race condition unique constraint violation or an unexpected disconnect), the endpoint catches the error and executes a specialized rollback query. This explicitly refunds the exact FanCoins to the user *before* finally tossing the `500 Server Error`.

### Response Payload Structure
```json
{
  "success": true,
  "listing_id": "uuid-string-of-market-item",
  "new_balance_fancoins": 900
}
```

## Summary
The Peer-to-Peer market backend is now structurally airtight. The soft-currency economy is firmly integrated, creating a satisfying sink for FanCoins, rewarding fitness activity, and enabling secure, verified player transactions pending smart contract implementations.
