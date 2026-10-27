"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArchiveRestore, Pencil, Plus, ReceiptText, Square } from "lucide-react";
import { toast } from "sonner";
import { BillDueRow, PayBillDialog } from "@/components/bills/bill-due";
import { BillForm } from "@/components/bills/bill-form";
import { CategoryIcon } from "@/components/finance/category-icon";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonth, monthStart } from "@/lib/dates";
import { paymentsLeft, scheduleLabel, unpaidTotal, type BillDue } from "@/lib/finance/bills";
import type { BillRow } from "@/lib/local/db";
import { useOverview, type Overview } from "@/lib/local/hooks";
import { setBillEnded } from "@/lib/local/mutations";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

function EndButton({ bill }: { bill: BillRow }) {
  const [isPending, startTransition] = useTransition();
  const ended = !!bill.archived_at;
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      aria-label={ended ? `Restart ${bill.name}` : `End ${bill.name}`}
      title={ended ? "Restart" : "End this bill"}
      onClick={() =>
        startTransition(async () => {
          const result = await setBillEnded(bill.id, !ended);
          if (result.error) toast.error(result.error);
          else toast.success(ended ? `${bill.name} restarted` : `${bill.name} ended`);
        })
      }
    >
      {ended ? <ArchiveRestore /> : <Square />}
    </Button>
  );
}

function Bills({ overview }: { overview: Overview }) {
  const router = useRouter();
  const params = useSearchParams();
  const { bills, billDues, categories, accounts, today } = overview;
  const [editing, setEditing] = useState<BillRow | "new" | null>(null);
  const [paying, setPaying] = useState<BillDue | null>(null);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const current = monthStart(today);
  const thisMonth = billDues.filter((d) => d.month === current || d.status === "overdue");
  const sorted = [...bills].sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at) || a.due_day - b.due_day);

  // Opened from a "due today" notification: /bills?pay=<bill id> opens its pay dialog
  const payId = params.get("pay");
  const linked = payId ? (billDues.find((d) => d.bill.id === payId && d.status !== "paid" && d.status !== "skipped") ?? null) : null;
  const shownPaying = paying ?? linked;
  const closePaying = () => {
    setPaying(null);
    if (payId) router.replace("/bills", { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Bills"
        description={bills.length > 0 ? `${formatPeso(unpaidTotal(billDues), { whole: true })} left to pay in ${formatMonth(current)}` : "Rent, load, subscriptions"}
      >
        <Button size="lg" onClick={() => setEditing("new")}>
          <Plus /> New bill
        </Button>
      </PageHeader>

      {bills.length === 0 ? (
        <Card className="max-w-xl">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
              <ReceiptText className="size-7" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold">No bills yet</span>
              <span className="max-w-sm text-sm text-muted-foreground">
                Add what you pay every month. On the due day it shows up here and on the dashboard, and one tap logs it.
              </span>
            </div>
            <Button onClick={() => setEditing("new")}>
              <Plus /> Add your first bill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{formatMonth(current)}</CardTitle>
              <CardDescription>Tap Paid on the due day. Paying logs it as an expense.</CardDescription>
            </CardHeader>
            <CardContent>
              {thisMonth.length === 0 ? (
                <p className="text-muted-foreground">Nothing due this month.</p>
              ) : (
                <ul className="divide-y">
                  {thisMonth.map((due) => (
                    <BillDueRow
                      key={`${due.bill.id}:${due.month}`}
                      due={due}
                      category={categoryById.get(due.bill.category_id)}
                      today={today}
                      onPayDifferently={setPaying}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">All bills</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {sorted.map((bill) => {
                  const left = paymentsLeft(bill, current, false);
                  return (
                    <li key={bill.id} className={cn("flex items-center gap-3 py-2.5", bill.archived_at && "opacity-60")}>
                      <CategoryIcon category={categoryById.get(bill.category_id) ?? { name: bill.name }} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">
                          {bill.name}
                          {bill.archived_at && <span className="ml-2 text-xs font-semibold uppercase text-muted-foreground">Ended</span>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {formatPeso(bill.amount, { whole: true })} · {scheduleLabel(bill.due_day)}
                          {left !== null && ` · ${left} ${left === 1 ? "payment" : "payments"} left`}
                        </span>
                      </span>
                      <Button variant="ghost" size="icon" aria-label={`Edit ${bill.name}`} onClick={() => setEditing(bill)}>
                        <Pencil />
                      </Button>
                      <EndButton bill={bill} />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <PayBillDialog due={shownPaying} accounts={accounts} onClose={closePaying} />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New bill" : "Edit bill"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <BillForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? undefined : editing}
              categories={categories}
              accounts={accounts}
              today={today}
              onSaved={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BillsPage() {
  const overview = useOverview();
  if (!overview) {
    return (
      <>
        <PageHeader title="Bills" description="Rent, load, subscriptions" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }
  return <Bills overview={overview} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <BillsPage />
    </Suspense>
  );
}
