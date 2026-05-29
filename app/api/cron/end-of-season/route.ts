import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { generateLeagueSchedule } from '@/app/actions/calendarActions';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn("Unauthorized cron attempt");
    }

    console.log("[CRON EndOfSeason] Starting...");

    // 1. Find all active instances
    const { data: activeInstances } = await supabaseAdmin
      .from('league_instances')
      .select('id, tier_level')
      .eq('status', 'active');

    if (!activeInstances || activeInstances.length === 0) {
      return NextResponse.json({ message: "No active instances" });
    }

    let processedCount = 0;

    for (const instance of activeInstances) {
      // Check if all matches for this instance are played
      const { count: unplayedCount } = await supabaseAdmin
        .from('league_matches')
        .select('*', { count: 'exact', head: true })
        .eq('league_instance_id', instance.id)
        .eq('is_played', false);

      if (unplayedCount !== null && unplayedCount > 0) {
        continue; // Season not finished yet
      }

      console.log(`[CRON EndOfSeason] Instance ${instance.id} is finished! Processing...`);
      
      // Get final standings
      const { data: finalStandings } = await supabaseAdmin
        .from('league_standings')
        .select('team_id, points, goals_for, goals_against')
        .eq('league_instance_id', instance.id)
        .order('points', { ascending: false })
        .order('goals_for', { ascending: false }); // simple tie-breaker

      if (!finalStandings || finalStandings.length === 0) continue;

      // Mark instance as finished
      await supabaseAdmin
        .from('league_instances')
        .update({ status: 'finished' })
        .eq('id', instance.id);

      // Re-distribute teams
      // Top 3 -> tier_level - 1 (min 1)
      // Bottom 3 -> tier_level + 1 (max 15)
      // Middle -> tier_level
      const newAssignments: { team_id: string, new_tier: number }[] = [];
      
      for (let i = 0; i < finalStandings.length; i++) {
        let nextTier = instance.tier_level;
        if (i < 3) nextTier = Math.max(1, instance.tier_level - 1); // Top 3
        else if (i >= finalStandings.length - 3) nextTier = Math.min(15, instance.tier_level + 1); // Bottom 3
        
        newAssignments.push({
          team_id: finalStandings[i].team_id,
          new_tier: nextTier
        });
      }

      // We need to put these teams into 'filling' instances of their new tiers
      for (const assignment of newAssignments) {
        // Find open instance
        let targetInstanceId;
        const { data: openInstances } = await supabaseAdmin
          .from('league_instances')
          .select('id')
          .eq('tier_level', assignment.new_tier)
          .eq('status', 'filling')
          .order('created_at', { ascending: true })
          .limit(1);

        if (openInstances && openInstances.length > 0) {
          targetInstanceId = openInstances[0].id;
        } else {
          // Create new
          const { data: newInstance } = await supabaseAdmin
            .from('league_instances')
            .insert({
              tier_level: assignment.new_tier,
              name: `Sector ${Math.floor(Math.random() * 900) + 100}`,
              status: 'filling'
            })
            .select('id')
            .single();
          targetInstanceId = newInstance!.id;
        }

        // Insert new standing for the new season
        await supabaseAdmin.from('league_standings').insert({
          team_id: assignment.team_id,
          league_instance_id: targetInstanceId,
          points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0
        });
      }
      processedCount++;
    }

    return NextResponse.json({ message: "EndOfSeason processed", processed: processedCount });
  } catch (error: any) {
    console.error("EndOfSeason error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
