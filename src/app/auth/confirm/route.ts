import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNext } from "@/lib/auth/next";
import { createClient } from "@/lib/supabase/server";

// Landing spot for links in Supabase emails (signup confirmation, password reset).
// Handles both link styles:
//   ?token_hash=...&type=...  our templates (supabase/templates/); works on any device or browser
//   ?code=...                 Supabase's default templates; only works in the browser that asked for the email
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNext(params.get("next"));

  const supabase = await createClient();
  let ok = false;

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  const target = ok ? next : "/login?notice=link-expired";
  return NextResponse.redirect(new URL(target, request.url));
}
