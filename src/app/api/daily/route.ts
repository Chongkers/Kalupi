import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { monthStart, today } from "@/lib/dates";
import { dueDateIn, isDueIn, type Bill } from "@/lib/finance/bills";
import { formatPeso } from "@/lib/money";

// Daily Vercel cron (vercel.json), 01:00 UTC = 9:00 AM in Manila. Two jobs:
// 1. Keep-alive: Supabase pauses free projects after a week without activity; public.ping() reads nothing.
// 2. Bill reminders (v1.0.4): a push to every device that turned them on, for bills due today.
//    Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and SUPABASE_SERVICE_ROLE_KEY; skipped without them.
export async function GET(request: NextRequest) {
  // Vercel sends the CRON_SECRET env var as a bearer token; anyone else is turned away
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const ping = await anon.rpc("ping");
  if (ping.error) return NextResponse.json({ ok: false, error: ping.error.message }, { status: 500 });

  const reminders = await sendBillReminders(url).catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "Reminders failed",
  }));
  return NextResponse.json({ ok: true, at: new Date().toISOString(), reminders });
}

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type DueBill = Pick<Bill, "id" | "name" | "amount" | "due_day" | "starts_on" | "ends_on" | "archived_at"> & { user_id: string };

async function sendBillReminders(url: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicKey || !privateKey || !serviceKey) return { skipped: "not configured" };

  // Push services want a contact URL for the sender; the app's own address will do
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? "localhost";
  webpush.setVapidDetails(`https://${site}`, publicKey, privateKey);

  // Service role: reads every user's bills, so this only ever runs on the server
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const day = today();
  const month = monthStart(day);

  const [bills, payments, subscriptions] = await Promise.all([
    admin.from("bills").select("id,user_id,name,amount,due_day,starts_on,ends_on,archived_at").is("deleted_at", null).is("archived_at", null),
    admin.from("bill_payments").select("bill_id").eq("month", month).is("deleted_at", null),
    admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth"),
  ]);
  for (const result of [bills, payments, subscriptions]) if (result.error) throw new Error(result.error.message);

  const settled = new Set((payments.data ?? []).map((p) => p.bill_id as string));
  const dueByUser = new Map<string, DueBill[]>();
  for (const bill of (bills.data ?? []) as DueBill[]) {
    if (!isDueIn(bill, month) || dueDateIn(bill.due_day, month) !== day || settled.has(bill.id)) continue;
    dueByUser.set(bill.user_id, [...(dueByUser.get(bill.user_id) ?? []), bill]);
  }

  let sent = 0;
  const gone: string[] = [];
  for (const sub of (subscriptions.data ?? []) as Subscription[]) {
    const due = dueByUser.get(sub.user_id);
    if (!due?.length) continue;
    const total = due.reduce((sum, b) => sum + b.amount, 0);
    const payload =
      due.length === 1
        ? {
            title: `${due[0].name} is due today`,
            body: `${formatPeso(due[0].amount)} · Tap to mark it paid`,
            url: `/bills?pay=${due[0].id}`,
            tag: `bill-${due[0].id}-${month}`,
          }
        : {
            title: `${due.length} bills are due today`,
            body: `${due.map((b) => b.name).join(", ")} · ${formatPeso(total)}`,
            url: "/bills",
            tag: `bills-${day}`,
          };
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
        TTL: 12 * 60 * 60,
      });
      sent++;
    } catch (error) {
      // 404 / 410: the browser dropped this subscription (app removed, permission revoked)
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) gone.push(sub.id);
    }
  }
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  return { due: [...dueByUser.values()].flat().length, sent, removed: gone.length };
}
