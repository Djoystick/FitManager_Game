import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  // 1. Basic Security Check: Require Bearer token matching CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Fetch all active players (exclude existing coaches)
    const { data: activePlayers, error: fetchError } = await supabase
      .from("players")
      .select("id, age, ovr, perks")
      .eq("is_nft_coach", false);

    if (fetchError) {
      throw new Error(`Failed to fetch active players: ${fetchError.message}`);
    }

    if (!activePlayers || activePlayers.length === 0) {
      return NextResponse.json({ message: "No active players to age" }, { status: 200 });
    }

    let agedCount = 0;
    let retiredCount = 0;

    // 3. Process Aging and Evolution Logic
    // Iterating sequentially ensures we can gracefully handle individual errors without failing the entire batch
    for (const player of activePlayers) {
      const newAge = player.age + 1;
      
      if (newAge >= 35) {
        // Player reaches retirement horizon: Evolve into NFT Coach
        const currentPerks = Array.isArray(player.perks) ? player.perks : [];
        const newPerks = [
          ...currentPerks, 
          { coach_bonus: "XP_BOOST_10_PERCENT", legacy_ovr: player.ovr }
        ];

        const { error: retireError } = await supabase
          .from("players")
          .update({
            age: newAge,
            is_nft_coach: true,
            perks: newPerks
          })
          .eq("id", player.id);

        if (retireError) {
          console.error(`[CRON ERROR] Failed to retire player ${player.id}: ${retireError.message}`);
          continue; // Skip market cleanup if retirement fails
        }

        // 4. Market Cleanup: Remove retiring player from P2P transfer market
        const { error: marketError } = await supabase
          .from("transfer_market")
          .delete()
          .eq("player_id", player.id);

        if (marketError) {
          console.error(`[CRON WARNING] Failed to cleanup market for retired player ${player.id}: ${marketError.message}`);
        }

        retiredCount++;
      } else {
        // Standard Aging
        const { error: ageError } = await supabase
          .from("players")
          .update({ age: newAge })
          .eq("id", player.id);

        if (ageError) {
          console.error(`[CRON ERROR] Failed to age player ${player.id}: ${ageError.message}`);
          continue;
        }
        
        agedCount++;
      }
    }

    // 5. Return execution summary
    return NextResponse.json({
      success: true,
      message: "Player aging and evolution process completed securely.",
      stats: {
        agedCount,
        retiredCount
      }
    });

  } catch (error: any) {
    console.error("Cron Age Players Fatal Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
