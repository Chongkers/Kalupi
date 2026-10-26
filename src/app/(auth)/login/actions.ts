"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/next";

export type LoginState = { error?: string; email?: string };

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic on purpose: don't reveal which emails have accounts
    const message =
      error.code === "email_not_confirmed"
        ? "Confirm your email first. Check your inbox for the link."
        : "Wrong email or password.";
    return { error: message, email };
  }

  // Throws to leave the page, so it must stay outside any try/catch
  redirect(safeNext(formData.get("next")));
}
