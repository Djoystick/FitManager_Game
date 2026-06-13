import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface CommentaryRequest {
  matchId: string;
}

export async function POST(req: Request) {
  try {
    const { matchId }: CommentaryRequest = await req.json();

    if (!matchId) {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
    }

    // 1. Fetch match data
    const { data: match, error: matchError } = await supabase
      .from('league_matches')
      .select('id, home_score, away_score, events, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // 2. Check cache (avoid re-generating commentary)
    const { data: existing } = await supabase
      .from('match_commentary')
      .select('commentary_text, highlights')
      .eq('match_id', matchId)
      .maybeSingle();

    if (existing?.commentary_text) {
      return NextResponse.json({
        success: true,
        commentary: existing.commentary_text,
        highlights: existing.highlights || [],
        cached: true,
      });
    }

    // 3. Prepare match events for AI
    const events = (match.events as any[]) || [];
    const goals = events.filter((e: any) => e.type === 'goal');
    const cards = events.filter((e: any) => e.type === 'yellow_card' || e.type === 'red_card' || e.type === 'second_yellow');
    const injuries = events.filter((e: any) => e.type === 'injury');
    const saves = events.filter((e: any) => e.type === 'save');
    const penalties = events.filter((e: any) => e.type === 'penalty_goal' || e.type === 'penalty_miss' || e.type === 'penalty_save');

    const homeName = (match.home_team as any)?.name || 'Home';
    const awayName = (match.away_team as any)?.name || 'Away';
    const score = `${match.home_score} : ${match.away_score}`;

    // 4. Build AI prompt
    const systemPrompt = `
Ты — профессиональный спортивный комментатор киберпанк-лиги FitManager.
Напиши эмоциональную, живую выжимку матча на русском языке (2-3 абзаца).

Стиль: журналистский, с метафорами из мира киберпанка.
Формат: Начни с общего впечатления от матча, затем опиши ключевые моменты,
заверши итоговым выводом.

Данные матча:
- ${homeName} ${score} ${awayName}
- Голы: ${goals.length > 0 ? goals.map((g: any) => `${g.player_name} (${g.minute}')`).join(', ') : 'не забито'}
- Карточки: ${cards.length > 0 ? cards.map((c: any) => `${c.player_name} ${c.type === 'red_card' ? '🔴' : '🟡'} (${c.minute}')`).join(', ') : 'нет'}
- Травмы: ${injuries.length > 0 ? injuries.map((i: any) => `${i.player_name} (${i.minute}')`).join(', ') : 'нет'}
- Сэйвы: ${saves.length} ключевых сэйвов
${penalties.length > 0 ? `- Пенальти: ${penalties.map((p: any) => `${p.player_name} ${p.type} (${p.minute}')`).join(', ')}` : ''}

ВАЖНО: Не повторяй факты дословно — перескажи их своими словами.
Используй киберпанк-лор: "нейроинтерфейс", "киберстадион", "голограммы", "импланты".
`;

    // @ts-ignore - Schema bypass for Gemini
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        commentary: {
          type: SchemaType.STRING,
          description: "2-3 paragraph match broadcast summary in Russian, cyberpunk style"
        },
        highlights: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "3-5 key moment descriptions as bullet points"
        }
      },
      required: ["commentary", "highlights"]
    };

    // 5. Call Gemini
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema as any,
      }
    });

    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();
    const aiOutput = JSON.parse(text);

    // 6. Cache in DB
    await supabase.from('match_commentary').insert({
      match_id: matchId,
      commentary_text: aiOutput.commentary,
      highlights: aiOutput.highlights || [],
    });

    return NextResponse.json({
      success: true,
      commentary: aiOutput.commentary,
      highlights: aiOutput.highlights || [],
      cached: false,
    });

  } catch (error: any) {
    console.error('[match-commentary] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
