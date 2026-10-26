/** Only paths on this site, so a ?next= link can't bounce someone to another domain. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
