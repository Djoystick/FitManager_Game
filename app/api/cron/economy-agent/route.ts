import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize Supabase Admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Gemini
// Ensure GEMINI_API_KEY is in .env.local
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function GET(request: Request) {
  // 1. Verify cron secret to prevent unauthorized execution
  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
  }

  try {
    // ── Rate Limiting: Check last run time ─────────────────────────────────
    const { data: lastLog } = await supabase
      .from('economy_logs')
      .select('log_date')
      .order('log_date', { ascending: false })
      .limit(1)
      .single();

    if (lastLog) {
      const lastRun = new Date(lastLog.log_date);
      const hoursSinceLastRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRun < 6) {
        return NextResponse.json({
          success: false,
          message: `Rate limited: last run ${hoursSinceLastRun.toFixed(1)}h ago. Min interval: 6h.`,
        }, { status: 429 });
      }
    }

    // 2. Gather Economic Metrics
    // Calculate Total FC in circulation
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('balance_fancoins');
      
    if (usersError) throw usersError;

    const totalFc = users.reduce((sum, user) => sum + (user.balance_fancoins || 0), 0);
    const activeUsers = users.length;

    // Query real FC mint/burn data from treasury_transactions for the last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentFcTx, error: fcTxError } = await supabase
      .from('treasury_transactions')
      .select('amount')
      .eq('currency', 'FC')
      .gte('created_at', twentyFourHoursAgo);

    if (fcTxError) throw fcTxError;

    const mintedToday = (recentFcTx ?? [])
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const burnedToday = Math.abs(
      (recentFcTx ?? [])
        .filter((tx) => tx.amount < 0)
        .reduce((sum, tx) => sum + tx.amount, 0)
    );

    // ── C17 SECURITY: Sanity bounds to prevent prompt injection ──────────
    const MAX_MULTIPLIER = 2;
    const safeTotalFc = Math.max(totalFc, 1);
    const safeMinted = Math.min(Math.max(0, mintedToday), safeTotalFc * MAX_MULTIPLIER);
    const safeBurned = Math.min(Math.max(0, burnedToday), safeTotalFc * MAX_MULTIPLIER);
    
    const today = new Date().toISOString().split('T')[0];

    // Log the daily snapshot (use sanitized values)
    await supabase.from('economy_logs').insert({
      log_date: today,
      total_fc_in_circulation: totalFc,
      total_fc_minted_today: safeMinted,
      total_fc_burned_today: safeBurned,
      active_users_today: activeUsers,
    }).select().single();

    // 3. Prepare Prompt for Gemini
    const systemPrompt = `
      You are the Central Bank AI of FitManager, a cyberpunk football management game.
      Your task is to analyze today's economic data and adjust game multipliers to prevent hyperinflation or severe depression.
      
      Rules for Multipliers:
      - match_reward (default 1.0): Valid range 0.7 to 1.3. Higher means players earn more per win. Lower curbs inflation.
      - medical_cost (default 1.0): Valid range 0.5 to 2.0. Higher means players pay more to heal injuries. Higher curbs inflation.
      - stadium_tax (default 1.0): Valid range 0.5 to 2.0. Higher means base upkeep is more expensive. Higher curbs inflation.
      - scouting_cost (default 1.0): Valid range 0.5 to 2.0. Higher means buying youth players costs more.
      
      Current Data:
      - Total FC in circulation: ${totalFc}
      - FC Minted Today: ${safeMinted}
      - FC Burned Today: ${safeBurned}
      - Active Users: ${activeUsers}
      
      Calculate the inflation risk. If Minted > Burned, inflation is happening. Adjust multipliers accordingly.
      Generate a public lore news article explaining the economic shift to the players in a cyberpunk corporate tone.
    `;

    // @ts-ignore - Bypass TS strict check for Schema
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        reasoning: {
          type: SchemaType.STRING,
          description: "Internal AI reasoning for the chosen multipliers based on the data."
        },
        multipliers: {
          type: SchemaType.OBJECT,
          properties: {
            match_reward: { type: SchemaType.NUMBER },
            medical_cost: { type: SchemaType.NUMBER },
            stadium_tax: { type: SchemaType.NUMBER },
            scouting_cost: { type: SchemaType.NUMBER }
          },
          required: ["match_reward", "medical_cost", "stadium_tax", "scouting_cost"]
        },
        lore_news_title: {
          type: SchemaType.STRING,
          description: "Catchy title for the social feed news update."
        },
        lore_news_body: {
          type: SchemaType.STRING,
          description: "The body of the news article, explaining the changes to the citizens in a cyberpunk style."
        }
      },
      required: ["reasoning", "multipliers", "lore_news_title", "lore_news_body"]
    };

    // 4. Call Gemini
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema as any,
      }
    });

    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();
    const aiDecision = JSON.parse(text);

    // 5. Clamp AI multipliers to safe ranges (C17 fix)
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    const m = aiDecision.multipliers;
    m.match_reward  = clamp(m.match_reward,  0.7, 1.3);
    m.medical_cost  = clamp(m.medical_cost,  0.5, 2.0);
    m.stadium_tax   = clamp(m.stadium_tax,   0.5, 2.0);
    m.scouting_cost = clamp(m.scouting_cost,  0.5, 2.0);

    // 6. Update Economy State
    await supabase.from('economy_state').insert({
      match_reward_multiplier: aiDecision.multipliers.match_reward,
      medical_cost_multiplier: aiDecision.multipliers.medical_cost,
      stadium_tax_multiplier: aiDecision.multipliers.stadium_tax,
      scouting_cost_multiplier: aiDecision.multipliers.scouting_cost,
    });

    // 6. Post Social Feed News
    await supabase.from('social_feed').insert({
      title: aiDecision.lore_news_title,
      body: aiDecision.lore_news_body,
      author: 'Central Bank AI',
      type: 'economy'
    });

    // Update log with reasoning
    await supabase
      .from('economy_logs')
      .update({ ai_reasoning: aiDecision.reasoning })
      .eq('log_date', today);

    return NextResponse.json({ 
      success: true, 
      decision: aiDecision 
    });

  } catch (error: any) {
    console.error('AI Economist Error:', error);

    // ── Fallback: Apply default multipliers if AI fails ─────────────────────
    const DEFAULT_MULTIPLIERS = {
      match_reward: 1.0,
      medical_cost: 1.0,
      stadium_tax: 1.0,
      scouting_cost: 1.0,
    };

    try {
      await supabase.from('economy_state').insert({
        match_reward_multiplier: DEFAULT_MULTIPLIERS.match_reward,
        medical_cost_multiplier: DEFAULT_MULTIPLIERS.medical_cost,
        stadium_tax_multiplier: DEFAULT_MULTIPLIERS.stadium_tax,
        scouting_cost_multiplier: DEFAULT_MULTIPLIERS.scouting_cost,
      });

      await supabase.from('social_feed').insert({
        title: '⚙️ Центральный банк: Режим по умолчанию',
        body: 'Временные технические неполадки. Множители экономики установлены на стандартные значения.',
        author: 'Central Bank AI',
        type: 'economy',
      });
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }

    return NextResponse.json({ error: error.message, fallback_applied: true }, { status: 500 });
  }
}
