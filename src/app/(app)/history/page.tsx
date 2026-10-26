"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Printer, Scale, Target } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { UsageBar } from "@/components/finance/budget-bar";
import { TransactionList } from "@/components/finance/transaction-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, formatMonth, monthStart, type DateString } from "@/lib/dates";
import { spentByCategory } from "@/lib/finance/budget";
import { inAndOut } from "@/lib/finance/list";
import { OPENING_BALANCE } from "@/lib/finance/types";
import { useMonth, useOverview, type Overview } from "@/lib/local/hooks";
import { formatPeso, formatSignedPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import { BudgetForm } from "../budgets/budget-form";

const statLabel = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

/** Every month from the first entry up to this one, newest first. */
function monthOptions(overview: Overview): DateString[] {
  const current = monthStart(overview.today);
  const first = overview.transactions[0] ? monthStart(overview.transactions[0].occurred_on) : current;
  const months: DateString[] = [];
  for (let m = current; m >= first && months.length < 120; m = addMonths(m, -1)) months.push(m);
  return months;
}

function MonthPicker({ month, options, onChange }: { month: DateString; options: DateString[]; onChange: (m: DateString) => void }) {
  const index = options.indexOf(month);
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        disabled={index === options.length - 1}
        onClick={() => onChange(options[index + 1])}
      >
        <ChevronLeft />
      </Button>
      <NativeSelect value={month} onChange={(e) => onChange(e.target.value)} aria-label="Month" selectClassName="h-9 min-w-44">
        {options.map((m) => (
          <NativeSelectOption key={m} value={m}>
            {formatMonth(m)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button variant="outline" size="icon" aria-label="Next month" disabled={index <= 0} onClick={() => onChange(options[index - 1])}>
        <ChevronRight />
      </Button>
    </div>
  );
}

function Stat({
  label,
  icon: Icon,
  value,
  hint,
  className,
}: {
  label: string;
  icon: typeof Scale;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className="print:shadow-none">
      <CardContent className="flex flex-col gap-1">
        <span className={cn(statLabel, "flex items-center gap-1.5")}>
          <Icon className="size-3.5" /> {label}
        </span>
        <span className={cn("text-2xl font-bold tabular-nums", className)}>{value}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

function Report({ month, overview }: { month: DateString; overview: Overview }) {
  const data = useMonth(month);
  const [editingBudget, setEditingBudget] = useState(false);
  if (!data) return <Skeleton className="h-96 w-full" />;

  const { transactions, categories, budget, budgetRow } = data;
  const openingId = categories.find((c) => c.kind === "income" && c.name === OPENING_BALANCE)?.id;
  const { moneyIn, moneyOut } = inAndOut(transactions, openingId);
  const net = moneyIn - moneyOut;
  const savedRate = moneyIn > 0 ? Math.round((net / moneyIn) * 100) : null;
  const isCurrent = month === monthStart(overview.today);

  const names = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory = [...spentByCategory(transactions)].map(([id, amount]) => ({ id, name: names.get(id) ?? "Unknown", amount }));
  byCategory.sort((a, b) => b.amount - a.amount);
  const biggest = byCategory[0]?.amount ?? 1;

  const limits = new Map(budgetRow?.items.map((i) => [i.category_id, i.limit_amount]));
  const budgetRows = categories
    .filter((c) => c.kind === "expense" && (!c.archived_at || limits.has(c.id)))
    .map((c) => ({ categoryId: c.id, name: c.name, limit: limits.get(c.id) ?? 0 }));

  const entries = [...transactions].reverse();

  return (
    <div className="flex flex-col gap-6">
      {/* Title card (report.html) */}
      <Card className="print:shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className={statLabel}>Monthly report</span>
            <span className="font-display text-2xl uppercase tracking-widest">{formatMonth(month)}</span>
            <span className="text-sm text-muted-foreground">
              {transactions.length} {transactions.length === 1 ? "entry" : "entries"}
              {isCurrent && " · month in progress"}
            </span>
          </div>
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer /> Save as PDF
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Income" icon={ArrowDownLeft} value={formatSignedPeso(moneyIn, "in")} className="text-income" />
        <Stat label="Expenses" icon={ArrowUpRight} value={formatSignedPeso(moneyOut, "out")} className="text-expense" />
        <Stat
          label="Net"
          icon={Scale}
          value={formatSignedPeso(Math.abs(net), net < 0 ? "out" : "in")}
          className={net < 0 ? "text-expense" : ""}
          hint={savedRate !== null ? (net >= 0 ? `Kept ${savedRate}% of income` : "Spent more than came in") : undefined}
        />
        <Stat
          label="Budget used"
          icon={Target}
          value={budget && budget.totalLimit > 0 ? `${budget.percentUsed}%` : "—"}
          className={budget && budget.totalSpent > budget.totalLimit ? "text-expense" : ""}
          hint={budget && budget.totalLimit > 0 ? `of ${formatPeso(budget.totalLimit, { whole: true })}` : "No budget this month"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Budget usage + edit */}
        <Card className="print:shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Budget</CardTitle>
            <CardDescription>
              {budget && budget.totalLimit > 0
                ? `${formatPeso(budget.totalSpent, { whole: true })} spent of ${formatPeso(budget.totalLimit, { whole: true })}${budget.customTotal ? " (your own limit)" : ""}`
                : "No limits were set for this month."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {budget && budget.totalLimit > 0 && (
              <UsageBar percent={budget.percentUsed} over={budget.totalSpent > budget.totalLimit} />
            )}
            {budget?.lines.map((line) => (
              <div key={line.categoryId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{line.name}</span>
                <span className={cn("shrink-0 tabular-nums", line.over ? "font-semibold text-expense" : "text-muted-foreground")}>
                  {formatPeso(line.spent, { whole: true })} / {formatPeso(line.limit, { whole: true })}
                </span>
              </div>
            ))}
            <Button variant="outline" className="self-start print:hidden" onClick={() => setEditingBudget((v) => !v)}>
              <ChevronDown className={cn("transition-transform", editingBudget && "rotate-180")} />
              {editingBudget ? "Close" : budgetRow ? "Edit this month's budget" : "Set a budget for this month"}
            </Button>
            {editingBudget && (
              <BudgetForm
                key={budgetRow?.id ?? "none"}
                month={month}
                rows={budgetRows}
                totalLimit={budgetRow?.totalLimit ?? null}
                showTemplateSwitch={isCurrent}
              />
            )}
          </CardContent>
        </Card>

        {/* Where it went */}
        <Card className="print:shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Where it went</CardTitle>
            <CardDescription>Spending by category</CardDescription>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-muted-foreground">No spending this month.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {byCategory.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatPeso(c.amount, { whole: true })}
                        <span className="ml-1.5 text-muted-foreground">{Math.round((c.amount / moneyOut) * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-expense/80" style={{ width: `${(c.amount / biggest) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction detail: rows open the editor, so past entries can be fixed */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Entries</h2>
        {entries.length > 0 ? (
          <TransactionList transactions={entries} accounts={overview.accounts} categories={categories} today={overview.today} />
        ) : (
          <p className="text-muted-foreground">Nothing logged this month.</p>
        )}
      </section>
    </div>
  );
}

function History() {
  const overview = useOverview();
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("month");
  if (!overview) return <Skeleton className="h-96 w-full" />;

  const options = monthOptions(overview);
  const month = requested && options.includes(requested) ? requested : options[0];

  return (
    <>
      <PageHeader title="History" description="Past months and their reports">
        <MonthPicker month={month} options={options} onChange={(m) => router.replace(`${pathname}?month=${m}`, { scroll: false })} />
      </PageHeader>
      <Report key={month} month={month} overview={overview} />
    </>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <History />
    </Suspense>
  );
}
