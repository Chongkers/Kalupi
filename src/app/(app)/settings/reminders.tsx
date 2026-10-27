"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push/client";

const HINTS: Record<PushState, string> = {
  on: "You'll get a notification at 9 AM on the day a bill is due.",
  off: "Get a notification at 9 AM on the day a bill is due.",
  blocked: "Notifications are blocked. Allow them for Kalupi in your browser or phone settings, then try again.",
  "needs-install": "On iPhone, add Kalupi to your Home Screen first (Share → Add to Home Screen), then turn this on there.",
  unsupported: "This browser can't show notifications.",
  "not-configured": "Reminders aren't set up on the server yet.",
};

/** Bill reminders on this device (v1.0.4). Each phone or browser turns them on separately. */
export function RemindersToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void pushState().then(setState);
  }, []);

  const toggle = (on: boolean) =>
    startTransition(async () => {
      const result = on ? await enablePush() : await disablePush();
      if (result.error) toast.error(result.error);
      else toast.success(on ? "Bill reminders on" : "Bill reminders off");
      setState(await pushState());
    });

  return (
    <label className="flex items-center justify-between gap-4">
      <span className="flex flex-col">
        <span className="font-medium">Bill reminders</span>
        <span className="text-sm text-muted-foreground">{state ? HINTS[state] : "Checking…"}</span>
      </span>
      <Switch
        checked={state === "on"}
        disabled={isPending || (state !== "on" && state !== "off")}
        onCheckedChange={toggle}
        aria-label="Bill reminders"
      />
    </label>
  );
}
