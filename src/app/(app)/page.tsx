"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SetupDialog } from "@/components/setup/setup-dialog";
import { BudgetBar } from "@/components/finance/budget-bar";
import { QuickAdd } from "@/components/finance/quick-add";
import { ProgressRing } from "@/components/trackers/progress-ring";
import { BudgetDial, FlowStat, noSpendStreak, StreakPill } from "@/components/finance/month-stats";
import { TransactionList } from "@/components/finance/transaction-list";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, dayOfMonth, formatMonth, monthStart } from "@/lib/dates";
import { dailyTotals, groupByDay, inAndOut } from "@/lib/finance/list";
import { ACCOUNT_KIND_LABELS } from "@/lib/finance/types";
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
                <ProgressRing percent={(t.total / t.target_amount) * 100} size="size-14" compact />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatPeso(t.total, { whole: true })} of {formatPeso(t.target_amount, { whole: true })}
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
  const { accounts, categories, available, budget, today, monthTransactions } = overview;
  const { moneyIn, moneyOut } = inAndOut(monthTransactions, overview.openingBalanceId);
  const { day, of } = dayOfMonth(today);
  const inDays = dailyTotals(monthTransactions, "income", of, overview.openingBalanceId);
  const outDays = dailyTotals(monthTransactions, "expense", of);
  const net = moneyIn - moneyOut;

  // Last month up to the same day, so a half-finished month compares fairly
  const prevStart = addMonths(monthStart(today), -1);
  const prevEnd = `${prevStart.slice(0, 8)}${String(Math.min(day, dayOfMonth(prevStart).of)).padStart(2, "0")}`;
  const prev = inAndOut(
    overview.transactions.filter((t) => t.occurred_on >= prevStart && t.occurred_on <= prevEnd),
    overview.openingBalanceId,
  );
  const prevLabel = formatMonth(prevStart).slice(0, 3);
  const incomeCount = inDays.filter((d) => d > 0).length;
  const expenseCount = monthTransactions.filter((t) => t.type === "expense").length;

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
            <span className={`text-2xl font-bold tabular-nums md:text-3xl ${available < 0 ? "text-expense" : ""}`}>
              {formatPeso(available)}
            </span>
            <span className="text-sm text-muted-foreground">
              Across {activeAccounts.length} {activeAccounts.length === 1 ? "account" : "accounts"}
            </span>
            <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-sm md:pt-3">
              <span className="text-muted-foreground">Net this month</span>
              <span className={`font-semibold tabular-nums ${net < 0 ? "text-expense" : "text-income"}`}>
                {formatSignedPeso(Math.abs(net), net < 0 ? "out" : "in")}
              </span>
            </div>
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
            <span className={statLabel}>Budget used</span>
            {budget && budget.totalLimit > 0 ? (
              <BudgetDial budget={budget} today={today} />
            ) : (
              <Link href="/budgets" className={linkClass}>
                Set a monthly budget
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

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
                  <BudgetBar key={line.categoryId} line={line} />
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
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex flex-col">
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
          <Link href="/add">
            <Plus /> Add entry
          </Link>
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
