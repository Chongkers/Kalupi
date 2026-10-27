import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Refreshes the auth session on every request so it doesn't expire mid-use.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Don't put code between createServerClient and getClaims: this call is what
  // triggers the refresh, and skipping it can log users out at random.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;
  const { pathname } = request.nextUrl;

  // Logged out: only the auth pages are reachable
  if (!isLoggedIn && !publicPaths.some((p) => pathname.startsWith(p))) {
    // Invite links come back here after logging in or signing up
    const next = pathname.startsWith("/invite/") ? pathname : null;
    return redirectKeepingCookies(request, response, "/login", next);
  }

  // Logged in: no reason to see login or signup again
  if (isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
    return redirectKeepingCookies(request, response, "/");
  }

  return response;
}

// Auth pages, plus what the installed app needs before anyone logs in
const publicPaths = ["/login", "/signup", "/forgot-password", "/auth/", "/serwist/", "/~offline", "/manifest.webmanifest", "/icons/", "/tesseract/", "/api/daily"];

// A redirect is a new response, so carry over any refreshed session cookies
function redirectKeepingCookies(request: NextRequest, response: NextResponse, pathname: string, next?: string | null) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = next ? `?next=${encodeURIComponent(next)}` : "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
