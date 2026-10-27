// Bill reminders by web push (v1.0.4). This device subscribes through its service worker and the
// subscription is saved to Supabase; a daily cron (src/app/api/daily/route.ts) sends "due today".
// Android: works in Chrome and the installed app. iPhone: only once Kalupi is on the Home Screen (iOS 16.4+).
import { getMeta } from "@/lib/local/db";
import { createClient } from "@/lib/supabase/client";

export type PushState = "unsupported" | "needs-install" | "blocked" | "off" | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && !!navigator.standalone);
}

export async function pushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !PUBLIC_KEY) return "unsupported";
  // iOS only offers push to installed web apps
  if (!("PushManager" in window)) return isIos() && !isInstalled() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) ? "on" : "off";
}

/** base64url VAPID key → bytes, as pushManager.subscribe wants it. */
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export async function enablePush(): Promise<{ error?: string }> {
  if (!navigator.onLine) return { error: "You're offline. Connect to turn on reminders." };
  const owner = await getMeta<{ userId: string }>("owner");
  if (!owner) return { error: "Not logged in." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: "Notifications are blocked. Allow them for Kalupi in your browser or phone settings." };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
  const json = subscription.toJSON();

  const supabase = createClient();
  // Replace this browser's row: it may have been saved before under an old key
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: owner.userId,
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  });
  if (error) {
    await subscription.unsubscribe();
    return { error: "Couldn't turn on reminders. Try again." };
  }
  return {};
}

/** Stop reminders on this device. Also called on logout, so the next person doesn't get yours. */
export async function disablePush(): Promise<{ error?: string }> {
  if (!("serviceWorker" in navigator)) return {};
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return {};
  try {
    await createClient().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  } catch {
    // Offline: the server drops it the first time a push to it fails
  }
  await subscription.unsubscribe();
  return {};
}
