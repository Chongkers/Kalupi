"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/next";
import { siteOrigin } from "@/lib/auth/site-origin";
import { createClient } from "@/lib/supabase/server";

export type SignupState = { error?: string; sentTo?: string; displayName?: string; email?: string };

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const keep = { displayName, email };

  if (!displayName || !email || !password) {
    return { error: "Fill in your name, email and password.", ...keep };
  }
  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password.", ...keep };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger to fill profiles.display_name
      data: { display_name: displayName },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`,
    },
  });

  if (error) {
    return { error: error.message, ...keep };
  }

  // Email confirmation off: Supabase logs the user in right away
  if (data.session) {
    redirect(next);
  }

  return { sentTo: email };
}
