import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/cron/economy-agent/route';
import { NextResponse } from 'next/server';

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null })
      };
      
      mockChain.then = function(resolve: any) {
         if (table === 'users') resolve({ data: [{ balance_fancoins: 1000 }, { balance_fancoins: 500 }], error: null });
         else if (table === 'treasury_transactions') resolve({ data: [{ amount: 15000 }, { amount: 5000 }, { amount: -8000 }], error: null });
         else resolve({ data: {}, error: null });
      };

      return mockChain;
    })
  }))
}));

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () => JSON.stringify({
                reasoning: "Inflation detected, raising taxes.",
                multipliers: {
                  match_reward: 0.9,
                  medical_cost: 1.2,
                  stadium_tax: 1.5,
                  scouting_cost: 1.1
                },
                lore_news_title: "Central Bank Raises Rates",
                lore_news_body: "Tough times ahead."
              })
            }
          })
        };
      }
    },
    SchemaType: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER' }
  };
});

describe('Economy Agent Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test_secret';
    process.env.GEMINI_API_KEY = 'test_key';
  });

  it('should reject unauthorized requests', async () => {
    const request = new Request('http://localhost/api/cron/economy-agent');
    const response = await GET(request) as NextResponse;
    expect(response.status).toBe(401);
  });

  it('should process economy snapshot and update state correctly', async () => {
    const request = new Request('http://localhost/api/cron/economy-agent', {
      headers: { 'authorization': 'Bearer test_secret' }
    });
    
    const response = await GET(request) as NextResponse;
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.decision.multipliers.match_reward).toBe(0.9);
  });
});
