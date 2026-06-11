import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase admin client to bypass RLS for cron job
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON: stamina-regen] Starting stamina regeneration process...');

    // 2. Fetch all teams' infrastructure to get Medical Center levels
    const { data: infraList, error: infraError } = await supabaseAdmin
      .from('infrastructure')
      .select('team_id, medical_center_level');

    if (infraError) {
      throw new Error(`Failed to fetch infrastructure: ${infraError.message}`);
    }

    // Map team_id -> medical_center_level
    const medLevels: Record<string, number> = {};
    if (infraList) {
      infraList.forEach(infra => {
        medLevels[infra.team_id] = infra.medical_center_level ?? 1;
      });
    }

    // 3. Fetch all players who need regeneration
    // Only fetch players where stamina < 100 AND is_injured = false
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, team_id, stamina')
      .eq('is_injured', false)
      .lt('stamina', 100);

    if (playersError) {
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    if (!players || players.length === 0) {
      console.log('[CRON: stamina-regen] No players need stamina regeneration.');
      return NextResponse.json({ success: true, message: 'No players need regeneration.' });
    }

    console.log(`[CRON: stamina-regen] Found ${players.length} players needing regeneration.`);

    // 4. Calculate new stamina for each player
    const updates = players.map(p => {
      const currentStamina = Number(p.stamina ?? 100);
      const missingStamina = 100 - currentStamina;
      
      // Get medical center level (default to 1 if not found)
      const medLevel = medLevels[p.team_id] || 1;
      
      // Base regen is 30% of missing. Each level adds 5%. Level 1 = 30%. Level 2 = 35%. Level 3 = 40%.
      // Formula: 0.30 + (medLevel - 1) * 0.05
      // Wait, let's make it more rewarding:
      // Level 1: 30%
      // Level 2: 35%
      // Level 3: 40%
      const regenRate = 0.30 + ((medLevel - 1) * 0.05);
      
      // Calculate recovered amount
      const recovered = Math.round(missingStamina * regenRate);
      const newStamina = Math.min(100, currentStamina + recovered);

      return {
        id: p.id,
        stamina: newStamina
      };
    });

    // 5. Batch update players
    // Supabase JS doesn't have a bulk update by default for heterogeneous values,
    // so we can either do individual updates or use an RPC. Since we might have 1000s of players,
    // we should use a Postgres function (RPC) or `upsert` if we include all required fields,
    // BUT we only have id and stamina. Upsert might overwrite other fields if not provided depending on schema.
    // Instead, since it's a cron and background, we can do batches of promises or a single RPC.
    
    // For safety without RPC, chunk updates 100 at a time:
    const chunkSize = 100;
    let updatedCount = 0;
    
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      
      const promises = chunk.map(update => 
        supabaseAdmin
          .from('players')
          .update({ stamina: update.stamina })
          .eq('id', update.id)
      );
      
      await Promise.all(promises);
      updatedCount += chunk.length;
      console.log(`[CRON: stamina-regen] Updated ${updatedCount}/${updates.length} players...`);
    }

    console.log('[CRON: stamina-regen] Successfully completed stamina regeneration.');
    
    return NextResponse.json({ 
      success: true, 
      processed_players: updatedCount 
    });

  } catch (error: any) {
    console.error('[CRON: stamina-regen] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
