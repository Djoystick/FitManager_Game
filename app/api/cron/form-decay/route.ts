import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Admin client — apply_form_decay() touches multiple users and requires service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Form decay runs once per day. Guard against double-execution.
const DECAY_COOLDOWN_HOURS = 22;

export async function GET(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const authHeader  = req.headers.get('authorization');
  const secretParam = new URL(req.url).searchParams.get('secret');
  
  const validBearer = process.env.CRON_SECRET && (
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    secretParam === process.env.CRON_SECRET
  );

  if (!validBearer) {
    console.warn('[form-decay] Unauthorized request blocked.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ── Idempotency gate ──────────────────────────────────────────────────────
    const { data: config } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'last_form_decay')
      .maybeSingle();

    if (config?.value) {
      const lastRun  = new Date(config.value).getTime();
      const elapsedH = (Date.now() - lastRun) / 1000 / 3600;

      if (elapsedH < DECAY_COOLDOWN_HOURS) {
        const remainH = (DECAY_COOLDOWN_HOURS - elapsedH).toFixed(1);
        console.log(`[form-decay] Cooldown active. Next decay in ~${remainH}h.`);
        return NextResponse.json({
          success: true,
          cooldown: true,
          message: `Cooldown active. Next form decay in ~${remainH}h.`,
        });
      }
    }

    // ── Execute Form Decay ────────────────────────────────────────────────────
    // Optimistic lock: write the new timestamp BEFORE calling the RPC.
    // If the RPC fails, roll back the timestamp so the next cron run can retry.
    const newTimestamp = new Date().toISOString();
    const oldTimestamp = config?.value ?? null;

    const { error: lockErr } = await supabaseAdmin
      .from('system_config')
      .upsert(
        { key: 'last_form_decay', value: newTimestamp },
        { onConflict: 'key' }
      );

    if (lockErr) {
      throw new Error(`Failed to set optimistic lock: ${lockErr.message}`);
    }

    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc('apply_form_decay');

    if (rpcError) {
      // Rollback: restore the old timestamp so the next cron can retry
      if (oldTimestamp) {
        await supabaseAdmin
          .from('system_config')
          .upsert(
            { key: 'last_form_decay', value: oldTimestamp },
            { onConflict: 'key' }
          );
      }
      throw new Error(`apply_form_decay RPC failed: ${rpcError.message}`);
    }

    const summary = result as {
      decayed:    number;
      maintained: number;
      skipped:    number;
      run_at:     string;
    };

    console.log(
      `[form-decay] Done. decayed=${summary.decayed}, maintained=${summary.maintained}, skipped=${summary.skipped}`
    );

    return NextResponse.json({
      success:    true,
      decayed:    summary.decayed,
      maintained: summary.maintained,
      skipped:    summary.skipped,
      run_at:     summary.run_at,
      message:    `Form decay applied. ${summary.decayed} players degraded, ${summary.maintained} maintained.`,
    });

  } catch (error: any) {
    console.error('[form-decay] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
