"use client";

import { useState } from "react";
import Link from "next/link";
import { AddEntryLink } from "@/components/finance/add-entry";
import { HandCoins, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SetupDialog } from "@/components/setup/setup-dialog";
import { BudgetBar } from "@/components/finance/budget-bar";
import { AccountIcon } from "@/components/finance/category-icon";
import { QuickAdd } from "@/components/finance/quick-add";
import { BillDueRow, PayBillDialog } from "@/components/bills/bill-due";
import { ProgressRing } from "@/components/trackers/progress-ring";
import { BudgetDial, FlowStat, noSpendStreak, StreakPill } from "@/components/finance/month-stats";
import { TransactionList } from "@/components/finance/transaction-list";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { addMonths, dayOfMonth, formatMonth, monthStart } from "@/lib/dates";
import { dailyTotals, groupByDay, inAndOut } from "@/lib/finance/list";
import { needsConfirming, unpaidTotal, type BillDue } from "@/lib/finance/bills";
import { ACCOUNT_KIND_LABELS } from "@/lib/finance/types";
import { setMeta } from "@/lib/local/db";
import { useOverview, useTrackers, type Overview } from "@/lib/local/hooks";
import { formatPeso, formatSignedPeso } from "@/lib/money";

const statLabel = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const linkClass = "text-sm font-medium text-primary underline underline-offset-4";

function MonthLine({ today }: { today: string }) {
  const { day, of } = dayOfMonth(today);
  return (
    <>
      {formatMonth(monthStart(today))} · day {day} of {of}
    </>
  );
}

function splitLine(owedToYou: number, youOwe: number) {
  if (owedToYou === 0 && youOwe === 0) return "All settled";
  return [
    owedToYou > 0 && `${formatPeso(owedToYou, { whole: true })} owed to you`,
    youOwe > 0 && `you owe ${formatPeso(youOwe, { whole: true })}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Bills due today or overdue (one tap to pay), then the next ones coming up. Shown whenever you have bills. */
function BillsCard({ overview }: { overview: Overview }) {
  const [paying, setPaying] = useState<BillDue | null>(null);
  const open = overview.billDues.filter((d) => d.status !== "paid" && d.status !== "skipped");
  const shown = [...needsConfirming(open), ...open.filter((d) => d.status === "upcoming")].slice(0, 4);
  if (!overview.bills.some((b) => !b.archived_at)) return null;
  const categoryById = new Map(overview.categories.map((c) => [c.id, c]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Upcoming bills</CardTitle>
        <CardAction>
          <Link href="/bills" className={linkClass}>
            See all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {shown.length > 0 ? (
          <ul className="divide-y">
            {shown.map((due) => (
              <BillDueRow
                key={`${due.bill.id}:${due.month}`}
                due={due}
                category={categoryById.get(due.bill.category_id)}
                today={overview.today}
                onPayDifferently={setPaying}
              />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">All of this month&apos;s bills are paid.</p>
        )}
      </CardContent>
      <PayBillDialog due={paying} accounts={overview.accounts} onClose={() => setPaying(null)} />
    </Card>
  );
}

function TrackersCard() {
  const data = useTrackers();
  const active = data?.trackers.filter((t) => !t.archived) ?? [];
  if (active.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Trackers</CardTitle>
        <CardAction>
          <Link href="/trackers" className={linkClass}>
            See all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {active.slice(0, 3).map((t) => (
            <li key={t.id}>
              <Link href={`/trackers/view?id=${t.id}`} className="flex items-center gap-3 rounded-lg transition-colors hover:bg-accent/40">
                {t.kind === "split" ? (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <HandCoins className="size-6" />
                  </span>
                ) : (
                  <ProgressRing percent={(t.total / t.target_amount) * 100} size="size-14" compact />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t.kind === "split"
                      ? splitLine(t.owedToYou, t.youOwe)
                      : `${formatPeso(t.total, { whole: true })} of ${formatPeso(t.target_amount, { whole: true })}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Dashboard({ overview }: { overview: Overview }) {
  // Spending counts your share of split bills, not what you fronted for friends
  const { accounts, categories, available, budget, today, monthSpending } = overview;
  const { moneyIn, moneyOut } = inAndOut(monthSpending, overview.openingBalanceId);
  // Bills still to pay this month (and last month's unconfirmed ones)
  const billsLeft = unpaidTotal(overview.billDues);
  // Optionally counts settle-ups as if everyone had paid: + what friends owe you, − what you owe them
  const { owedToYou, youOwe } = overview.owed;
  const hasOwed = owedToYou > 0 || youOwe > 0;
  const balance = available + (overview.countOwed ? owedToYou - youOwe : 0);
  const { day, of } = dayOfMonth(today);
  const inDays = dailyTotals(monthSpending, "income", of, overview.openingBalanceId);
  const outDays = dailyTotals(monthSpending, "expense", of);
  const net = moneyIn - moneyOut;

  // Last month up to the same day, so a half-finished month compares fairly
  const prevStart = addMonths(monthStart(today), -1);
  const prevEnd = `${prevStart.slice(0, 8)}${String(Math.min(day, dayOfMonth(prevStart).of)).padStart(2, "0")}`;
  const prev = inAndOut(
    overview.spending.filter((t) => t.occurred_on >= prevStart && t.occurred_on <= prevEnd),
    overview.openingBalanceId,
  );
  const prevLabel = formatMonth(prevStart).slice(0, 3);
  const incomeCount = inDays.filter((d) => d > 0).length;
  const expenseCount = monthSpending.filter((t) => t.type === "expense" && t.amount > 0).length;

  const recent = groupByDay(overview.transactions).flatMap((g) => g.items).slice(0, 5);
  const activeAccounts = accounts.filter((a) => !a.archived);

  return (
    <>
      <QuickAdd overview={overview} />

      {/* Stat row (mockups p.1 and p.10) */}
      {/* Phones: balance, then In | Out side by side, then budget, all on one screen */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Card className="col-span-2 xl:col-span-1 [--card-spacing:--spacing(3)] md:[--card-spacing:--spacing(4)]">
          <CardContent className="flex h-full flex-col gap-1">
            <span className={statLabel}>Available balance</span>
            <span className={`text-2xl font-bold tabular-nums md:text-3xl ${balance < 0 ? "text-expense" : ""}`}>
              {formatPeso(balance)}
            </span>
            <span className="text-sm text-muted-foreground">
              Across {activeAccounts.length} {activeAccounts.length === 1 ? "account" : "accounts"}
              {overview.countOwed && hasOwed && ", once friends settle up"}
            </span>
            <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-sm md:pt-3">
              <span className="text-muted-foreground">Net this month</span>
              <span className={`font-semibold tabular-nums ${net < 0 ? "text-expense" : "text-income"}`}>
                {formatSignedPeso(Math.abs(net), net < 0 ? "out" : "in")}
              </span>
            </div>
            {billsLeft > 0 && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <Link href="/bills" className="text-muted-foreground underline-offset-4 hover:underline">
                  After bills
                </Link>
                <span className={`font-semibold tabular-nums ${balance - billsLeft < 0 ? "text-expense" : ""}`}>
                  {formatPeso(balance - billsLeft)}
                </span>
              </div>
            )}
            {(hasOwed || overview.countOwed) && (
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  Count settle-ups{" "}
                  <span className="tabular-nums">
                    ({formatSignedPeso(Math.abs(owedToYou - youOwe), owedToYou >= youOwe ? "in" : "out")})
                  </span>
                </span>
                <Switch
                  checked={overview.countOwed}
                  onCheckedChange={(on) => void setMeta("countOwed", on)}
                  aria-label="Add what friends owe you to the balance, and take off what you owe"
                />
              </label>
            )}
          </CardContent>
        </Card>
        <Card className="[--card-spacing:--spacing(3)] md:[--card-spacing:--spacing(4)]">
          <CardContent className="h-full">
            <FlowStat
              direction="in"
              days={inDays}
              today={today}
              lastMonthToDate={prev.moneyIn}
              lastMonthLabel={prevLabel}
              footer={incomeCount > 0 ? `Money came in on ${incomeCount} ${incomeCount === 1 ? "day" : "days"}` : "No income logged yet"}
            />
          </CardContent>
        </Card>
        <Card className="[--card-spacing:--spacing(3)] md:[--card-spacing:--spacing(4)]">
          <CardContent className="h-full">
            <FlowStat
              direction="out"
              days={outDays}
              today={today}
              lastMonthToDate={prev.moneyOut}
              lastMonthLabel={prevLabel}
              footer={
                <span className="flex flex-wrap items-center gap-2">
                  <StreakPill days={noSpendStreak(outDays, day)} />
                  <span>
                    {expenseCount} {expenseCount === 1 ? "expense" : "expenses"}
                  </span>
                </span>
              }
            />
          </CardContent>
        </Card>
        <Card className="col-span-2 xl:col-span-1 [--card-spacing:--spacing(3)] md:[--card-spacing:--spacing(4)]">
          <CardContent className="flex h-full flex-col gap-2 md:gap-3">
            {/* BudgetDial has its own title row, with the status badge */}
            {budget && budget.totalLimit > 0 ? (
              <BudgetDial budget={budget} today={today} committed={billsLeft} />
            ) : (
              <>
                <span className={statLabel}>Budget used</span>
                <Button asChild size="sm" className="self-start">
                  <Link href="/budgets">
                    <Plus /> Set a monthly budget
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right under the numbers, so what's due is seen without scrolling */}
      <BillsCard overview={overview} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent</CardTitle>
            <CardAction>
              <Link href="/transactions" className={linkClass}>
                See all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recent.length > 0 ? (
              <TransactionList transactions={recent} accounts={accounts} categories={categories} today={today} grouped={false} />
            ) : (
              <p className="text-muted-foreground">Nothing logged yet. Tap + to add your first entry.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <TrackersCard />

          {budget && budget.lines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Budgets</CardTitle>
                <CardAction>
                  <Link href="/budgets" className={linkClass}>
                    Manage
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {budget.lines.slice(0, 5).map((line) => (
                  <BudgetBar key={line.categoryId} line={line} category={categories.find((c) => c.id === line.categoryId)} />
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Accounts</CardTitle>
              <CardDescription>Balances right now</CardDescription>
              <CardAction>
                <Link href="/settings/accounts" className={linkClass}>
                  Manage
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {activeAccounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <AccountIcon kind={a.kind} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{ACCOUNT_KIND_LABELS[a.kind]}</span>
                    </span>
                    <span className={`font-semibold tabular-nums ${a.balance < 0 ? "text-expense" : ""}`}>
                      {formatPeso(a.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export default function DashboardPage() {
  const overview = useOverview();
  // First login: no accounts yet, so the startup wizard opens over a blurred dashboard
  const needsSetup = overview !== undefined && overview.accounts.length === 0;

  const page = (
    <>
      <PageHeader title="Dashboard" description={overview ? <MonthLine today={overview.today} /> : "This month at a glance"}>
        <Button asChild size="lg" className="hidden md:inline-flex">
          <AddEntryLink>
            <Plus /> Add entry
          </AddEntryLink>
        </Button>
      </PageHeader>
      {overview ? <Dashboard overview={overview} /> : <DashboardSkeleton />}
    </>
  );

  if (!needsSetup) return page;

  const expenseCategories = overview.categories
    .filter((c) => c.kind === "expense" && !c.archived_at)
    .map(({ id, name }) => ({ id, name }));

  return (
    <>
      {/* inert: no tabbing or clicking into the dashboard behind the wizard */}
      <div inert className="flex flex-col gap-6 blur-sm select-none">
        {page}
      </div>
      <SetupDialog expenseCategories={expenseCategories} />
    </>
  );
}
