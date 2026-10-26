import { headers } from "next/headers";

/** Where auth emails should link back to: http://localhost:3000 locally, the Vercel domain in production. */
export async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}
