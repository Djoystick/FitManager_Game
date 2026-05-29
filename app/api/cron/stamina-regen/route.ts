import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use admin client — regenerate_stamina is a privileged operation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Stamina regen runs once per day. Idempotency: we allow it to run only if
// the last regen was >22 hours ago (tracks via a dedicated system_config row).
// If the table/row doesn't exist yet, we run unconditionally.
const REGEN_COOLDOWN_HOURS = 22;

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader   = req.headers.get('authorization');
  const manualSecret = req.nextUrl?.searchParams?.get('secret');
  const validBearer  = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validSecret  = manualSecret === process.env.CRON_SECRET_MANUAL;

  if (!validBearer && !validSecret) {
    console.warn('[stamina-regen] Unauthorized request blocked.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ── Idempotency gate: check last_stamina_regen in system_config ───────────
    const { data: config } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'last_stamina_regen')
      .maybeSingle();

    if (config?.value) {
      const lastRegen  = new Date(config.value).getTime();
      const elapsedH   = (Date.now() - lastRegen) / 1000 / 3600;

      if (elapsedH < REGEN_COOLDOWN_HOURS) {
        const remainH = (REGEN_COOLDOWN_HOURS - elapsedH).toFixed(1);
        console.log(`[stamina-regen] Cooldown active. Next regen in ~${remainH}h.`);
        return NextResponse.json({
          success: true,
          cooldown: true,
          message: `Cooldown active. Next regen in ~${remainH}h.`,
        });
      }
    }

    // ── Execute stamina regeneration ──────────────────────────────────────────
    const { error: rpcError } = await supabaseAdmin.rpc('regenerate_stamina');

    if (rpcError) {
      throw new Error(`Failed to execute regenerate_stamina RPC: ${rpcError.message}`);
    }

    // ── Update last_stamina_regen timestamp ───────────────────────────────────
    await supabaseAdmin
      .from('system_config')
      .upsert({ key: 'last_stamina_regen', value: new Date().toISOString() }, { onConflict: 'key' });

    console.log('[stamina-regen] Stamina regeneration completed.');
    return NextResponse.json({
      success: true,
      message: 'Stamina regeneration completed successfully.',
    });

  } catch (error: any) {
    console.error('[stamina-regen] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
