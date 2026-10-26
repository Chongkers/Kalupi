"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { error?: string; saved?: boolean };

export async function updateDisplayName(_prevState: ProfileState, formData: FormData): Promise<ProfileState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) {
    return { error: "Enter a display name." };
  }
  if (displayName.length > 40) {
    return { error: "Keep it to 40 characters or fewer." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    return { error: "You're logged out. Log in again to save." };
  }

  // RLS only lets a user update their own row; the eq() picks it
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
  if (error) {
    return { error: "Couldn't save. Check your connection and try again." };
  }

  // Refresh the account menu in the shell
  revalidatePath("/", "layout");
  return { saved: true };
}
