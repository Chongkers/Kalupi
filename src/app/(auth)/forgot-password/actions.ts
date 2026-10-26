"use server";

import { siteOrigin } from "@/lib/auth/site-origin";
import { createClient } from "@/lib/supabase/server";

export type ForgotState = { error?: string; sentTo?: string };

export async function sendResetLink(_prevState: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });

  // Rate limits are worth reporting; "no such user" is not (it would reveal who has an account)
  if (error?.status === 429) {
    return { error: "Too many emails sent. Wait a few minutes and try again." };
  }

  return { sentTo: email };
}
