import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

// Daily Vercel cron (vercel.json). Supabase pauses free projects after a week without activity;
// one tiny query a day keeps it awake. public.ping() reads nothing.
export async function GET(request: NextRequest) {
  // Vercel sends the CRON_SECRET env var as a bearer token; anyone else is turned away
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.rpc("ping");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
