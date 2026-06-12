import { describe, it, expect, vi } from 'vitest';

// We mock the DB functions so the engine can run purely in-memory
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  }))
}));

import { simulateMatch } from '@/app/utils/matchEngine';

describe('Match Engine v5.0', () => {
  it('should process a match and return valid structures', async () => {
    // Generate mock teams
    const mockHomeLineup = Array(11).fill(null).map((_, i) => ({
      id: `home_player_${i}`,
      name: `Home Player ${i}`,
      position: i === 0 ? 'GK' : i < 5 ? 'DEF' : i < 9 ? 'MID' : 'FWD',
      stats: {
        pace: 75,
        shooting: 75,
        passing: 75,
        dribbling: 75,
        defending: 75,
        physical: 75
      },
      traits: [],
      stamina: 100,
      is_injured: false
    }));

    const mockAwayLineup = Array(11).fill(null).map((_, i) => ({
      id: `away_player_${i}`,
      name: `Away Player ${i}`,
      position: i === 0 ? 'GK' : i < 5 ? 'DEF' : i < 9 ? 'MID' : 'FWD',
      stats: {
        pace: 75,
        shooting: 75,
        passing: 75,
        dribbling: 75,
        defending: 75,
        physical: 75
      },
      traits: [],
      stamina: 100,
      is_injured: false
    }));

    const result = simulateMatch(
      mockHomeLineup as any[],
      mockAwayLineup as any[],
      [], // homeBench
      [], // awayBench
      {}, // homeGreenLinks
      {}  // awayGreenLinks
    );

    expect(result).toBeDefined();
    expect(result.score).toBeDefined();
    expect(typeof result.score.home).toBe('number');
    expect(typeof result.score.away).toBe('number');
    expect(result.staminaDrain).toBeDefined();
  });
});
