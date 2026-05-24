/**
 * matchService.ts
 *
 * Server-side Match Service with in-memory OVR caching.
 * Minimises Supabase round-trips on the free tier by caching
 * aggregate team OVR values for a configurable TTL (default 60 s).
 *
 * Usage:
 *   import { matchService } from '@/services/matchService';
 *
 *   // Cached OVR lookup
 *   const ovr = await matchService.getTeamOVR(teamId);
 *
 *   // Invalidate after a training session updates a player's OVR
 *   matchService.invalidateTeamOVR(teamId);
 *
 *   // Process a single match (calls the DB RPC)
 *   const result = await matchService.conductMatch(matchId);
 */

import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchResult {
  home_team_id:    string;
  away_team_id:    string;
  home_score:      number;
  away_score:      number;
  stamina_drained: number;
  h_final_power:   number;
  a_final_power:   number;
}

interface OVRCacheEntry {
  ovr:       number;
  cachedAt:  number; // epoch ms
}

// ─── Cache Configuration ───────────────────────────────────────────────────────

/**
 * Time-to-live for cached OVR entries in milliseconds.
 * On Supabase free tier, reducing DB reads is critical.
 * 60 seconds is a sensible balance — stale during a match
 * is fine because the RPC uses FOR UPDATE inside the DB.
 */
const OVR_CACHE_TTL_MS = 60_000;

// Module-level in-memory store (survives across requests within the same
// Next.js server process / Vercel function warm instance).
const ovrCache = new Map<string, OVRCacheEntry>();

// ─── Match Service ────────────────────────────────────────────────────────────

export const matchService = {
  /**
   * Returns the aggregate starting-lineup OVR for a team.
   * Checks the in-process cache first; falls back to a Supabase query.
   */
  async getTeamOVR(teamId: string): Promise<number> {
    const now = Date.now();
    const cached = ovrCache.get(teamId);

    if (cached && now - cached.cachedAt < OVR_CACHE_TTL_MS) {
      return cached.ovr;
    }

    // Cache miss — fetch from DB
    const { data, error } = await supabase
      .from('players')
      .select('ovr')
      .eq('team_id', teamId)
      .eq('lineup_status', 'starting');

    if (error) {
      console.error(`[matchService] OVR fetch error for team ${teamId}:`, error.message);
      return 0;
    }

    const aggregate = data?.reduce((sum, p) => sum + (p.ovr ?? 0), 0) ?? 0;

    ovrCache.set(teamId, { ovr: aggregate, cachedAt: now });
    return aggregate;
  },

  /**
   * Explicitly removes a team's cached OVR entry.
   * Call this after any event that modifies a player's OVR
   * (training, transfers, formation changes) to prevent stale reads
   * being served to subsequent match simulations.
   */
  invalidateTeamOVR(teamId: string): void {
    ovrCache.delete(teamId);
  },

  /**
   * Invokes the DB-level `conduct_match` RPC for a given match ID.
   * The heavy logic (FOR UPDATE locking, score generation, stamina drain)
   * is handled atomically inside PostgreSQL — this is a thin wrapper.
   */
  async conductMatch(matchId: string): Promise<MatchResult | null> {
    const { data, error } = await supabase.rpc('conduct_match', { m_id: matchId });

    if (error) {
      console.error(`[matchService] conduct_match RPC error for match ${matchId}:`, error.message);
      return null;
    }

    const result = data as MatchResult;

    // Invalidate both teams' caches since starters just lost 15-20 stamina
    // (stamina changes don't affect OVR, but this guards future additions).
    this.invalidateTeamOVR(result.home_team_id);
    this.invalidateTeamOVR(result.away_team_id);

    return result;
  },

  /**
   * Returns all unprocessed (unsimulated) matches scheduled up to now.
   * Used by the Vercel Cron endpoint to build its processing queue.
   */
  async fetchPendingMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id,
        home_team_id,
        away_team_id,
        match_date,
        home_team:teams!home_team_id(name),
        away_team:teams!away_team_id(name)
      `)
      .eq('is_simulated', false)
      .lte('match_date', new Date().toISOString())
      .order('match_date', { ascending: true });

    if (error) {
      console.error('[matchService] fetchPendingMatches error:', error.message);
      return [];
    }

    return data ?? [];
  },
};
