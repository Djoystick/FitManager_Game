# Report: Dynamic Tactical Formations & Auto-Adjustment

## 1. Tactical Implementation
The Football Manager mode now supports dynamic tactical formations (`4-4-2`, `4-3-3`, `3-5-2`), replacing the hardcoded default. This provides managers with the flexibility to adapt their lineup based on the strengths of their current roster.

### UI Architecture
- A highly stylized Formation Selector has been injected directly above the Tactical Pitch.
- Selecting a new formation triggers an instantaneous UI transition (`isFormationLoading`), blurring the pitch slightly while the API recalculates the optimal squad layout.
- The CSS Grid / Flexbox architecture inherently adapts to the new array lengths. For example, if a `4-3-3` is selected, the `mids` array dynamically shrinks to 3 players, naturally centering them, while the `fwds` array expands to 3.

## 2. Auto-Adjustment Logic
When a manager switches a formation, the `starting` 11 players might no longer fit the structural requirements of the new layout (e.g., switching from 4-4-2 to 3-5-2 leaves the manager with an illegal lineup of 4 defenders).

To safely resolve this, an Auto-Adjustment Script was implemented in the API (`app/api/lineup/formation/route.ts`).

### Execution Flow:
1. **Global Bench Reset**:
   Every single active player (all 16) is temporarily reset to `lineup_status: 'bench'` in memory.
2. **Structural Requirements Mapping**:
   The API parses the precise constraints of the target formation:
   ```typescript
   const reqs = {
     '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
     '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
     '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
   };
   ```
3. **OVR-Based Auto-Draft**:
   For each positional category (`GK`, `DEF`, `MID`, `FWD`), the script filters the 16-player roster and sorts them strictly by `ovr` (Descending order).
   ```typescript
   const available = playersToUpdate
     .filter(p => p.position === pos)
     .sort((a, b) => b.ovr - a.ovr); 
   ```
4. **Lineup Injection**:
   The engine precisely slices the top `N` players required for that position (e.g., the top 3 Midfielders for a 4-3-3) and forcefully upgrades their status back to `lineup_status: 'starting'`.
5. **Bulk Database Commit**:
   A parallelized array of `supabase.from('players').update()` promises is fired, instantly committing the optimized 16-player state to the database without data loss.
