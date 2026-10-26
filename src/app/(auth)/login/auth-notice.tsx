"use client";

import { useSearchParams } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";

const notices = {
  "logged-out": { icon: Check, text: "You've logged out. See you soon.", className: "bg-mint text-mint-foreground" },
  "link-expired": {
    icon: TriangleAlert,
    text: "That link expired or was already used. Request a new one.",
    className: "bg-destructive/10 text-destructive",
  },
};

/** Banner from ?notice=..., set by logout and by /auth/confirm. Render inside <Suspense>. */
export function AuthNotice() {
  const key = useSearchParams().get("notice");
  const notice = key && key in notices ? notices[key as keyof typeof notices] : null;
  if (!notice) return null;

  const Icon = notice.icon;
  return (
    <div role="status" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${notice.className}`}>
      <Icon className="size-4 shrink-0" />
      {notice.text}
    </div>
  );
}
