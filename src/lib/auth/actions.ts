"use server";

import { createClient } from "@/lib/supabase/server";

/** Ends the session (clears the auth cookies). The caller wipes the device and goes to /login. */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
