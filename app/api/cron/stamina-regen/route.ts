import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  // 1. Basic security check: Require Bearer token matching CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Execute the batch SQL update via RPC to avoid node.js memory bottlenecks
    const { error: rpcError } = await supabase.rpc("regenerate_stamina");

    if (rpcError) {
      throw new Error(`Failed to execute regenerate_stamina RPC: ${rpcError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Stamina regeneration completed successfully via batch SQL update",
    });
  } catch (error: any) {
    console.error("Cron Stamina Regen Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
