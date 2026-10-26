"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Carries ?next= along (e.g. an invite link) when switching between login and signup. Render inside <Suspense>. */
export function NextLink({ href, ...props }: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string }) {
  const next = useSearchParams().get("next");
  return <Link href={next ? `${href}?next=${encodeURIComponent(next)}` : href} {...props} />;
}

/** Hidden form field with ?next=, read by the login and signup actions. Render inside <Suspense>. */
export function NextField() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}
