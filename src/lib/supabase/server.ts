import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

// Supabase client for Server Components, Server Actions and Route Handlers.
// Create a new one per request; don't share it between requests.
export async function createClient() {
  // Supabase checks token expiry with Date.now(); this marks everything after as request-time only,
  // so Cache Components doesn't flag it while prerendering
  await connection();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, which can't set cookies.
            // Safe to ignore: src/proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}
