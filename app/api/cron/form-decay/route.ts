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
  const manualSecret = req.nextUrl?.searchParams?.get('secret');
  const validBearer  = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validSecret  = manualSecret === process.env.CRON_SECRET_MANUAL;

  if (!validBearer && !validSecret) {
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
    // Calls the apply_form_decay() SQL function (migration 00039).
    // Returns: { decayed, maintained, skipped, run_at }
    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc('apply_form_decay');

    if (rpcError) {
      throw new Error(`apply_form_decay RPC failed: ${rpcError.message}`);
    }

    // ── Update last_form_decay timestamp ─────────────────────────────────────
    await supabaseAdmin
      .from('system_config')
      .upsert(
        { key: 'last_form_decay', value: new Date().toISOString() },
        { onConflict: 'key' }
      );

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
