import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    if (!req.url.includes('localhost')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { data: activePlayers, error: fetchError } = await supabaseAdmin
      .from("players")
      .select("id, age, ovr, stats")
      .eq("is_retired", false); // Use new is_retired flag

    if (fetchError) {
      throw new Error(`Failed to fetch active players: ${fetchError.message}`);
    }

    if (!activePlayers || activePlayers.length === 0) {
      return NextResponse.json({ message: "No active players to age" }, { status: 200 });
    }

    let agedCount = 0;
    let retiredCount = 0;

    for (const player of activePlayers) {
      const newAge = player.age + 1;
      
      if (newAge >= 35) {
        // Player reaches retirement horizon
        const { error: retireError } = await supabaseAdmin
          .from("players")
          .update({
            age: newAge,
            is_retired: true,
            lineup_status: 'bench' // Force them to bench
          })
          .eq("id", player.id);

        if (retireError) {
          console.error(`[CRON ERROR] Failed to retire player ${player.id}: ${retireError.message}`);
          continue; 
        }

        // Market Cleanup
        await supabaseAdmin.from("transfer_market").delete().eq("player_id", player.id);
        retiredCount++;
      } else {
        // Standard Aging + OVR Decay
        let decay = 0;
        if (newAge === 31) decay = 1;
        else if (newAge === 32) decay = 2;
        else if (newAge === 33) decay = 3;
        else if (newAge === 34) decay = 4;
        else if (newAge > 34) decay = 5;

        const newOvr = Math.max(1, (player.ovr || 50) - decay);
        
        // Also reduce stats slightly if decayed
        let newStats = player.stats;
        if (decay > 0 && newStats) {
          newStats = { ...newStats };
          for (const key in newStats) {
             newStats[key] = Math.max(1, newStats[key] - decay);
          }
        }

        const { error: ageError } = await supabaseAdmin
          .from("players")
          .update({ age: newAge, ovr: newOvr, stats: newStats })
          .eq("id", player.id);

        if (ageError) {
          console.error(`[CRON ERROR] Failed to age player ${player.id}: ${ageError.message}`);
          continue;
        }
        
        agedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Player aging and evolution process completed securely.",
      stats: { agedCount, retiredCount }
    });

  } catch (error: any) {
    console.error("Cron Age Players Fatal Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
