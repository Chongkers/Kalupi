"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/next";
import { siteOrigin } from "@/lib/auth/site-origin";
import { LEGAL_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export type SignupState = {
  error?: string;
  sentTo?: string;
  displayName?: string;
  email?: string;
  termsAccepted?: boolean;
};

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const termsAccepted = formData.get("terms") === "on";
  const next = safeNext(formData.get("next"));
  const keep = { displayName, email, termsAccepted };

  if (!displayName || !email || !password) {
    return { error: "Fill in your name, email and password.", ...keep };
  }
  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password.", ...keep };
  }
  // The checkbox is required in the form too; this covers requests that skip it
  if (!termsAccepted) {
    return { error: "Agree to the Terms and Privacy Policy to create an account.", ...keep };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // display_name is read by the handle_new_user trigger to fill profiles.display_name.
      // terms_* records which version of the Terms and Privacy Policy they agreed to, and when.
      data: { display_name: displayName, terms_version: LEGAL_VERSION, terms_accepted_at: new Date().toISOString() },
      // Always has a query string: the email template appends &token_hash=...&type=email to it
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
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
