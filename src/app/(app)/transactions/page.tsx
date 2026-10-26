"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/finance/transaction-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, formatMonth, monthEnd, monthStart } from "@/lib/dates";
import { filterTransactions, inAndOut } from "@/lib/finance/list";
import type { TransactionType } from "@/lib/finance/types";
import { useOverview } from "@/lib/local/hooks";
import { formatSignedPeso } from "@/lib/money";
import { TransactionFilters, type FilterValues } from "./filters";

function readFilters(params: URLSearchParams, fallbackMonth: string): FilterValues {
  const one = (key: string) => params.get(key) ?? "";
  const month = /^\d{4}-\d{2}-01$/.test(one("month")) ? one("month") : fallbackMonth;
  return { month, type: one("type") || "all", account: one("account"), category: one("category"), q: one("q") };
}

function Transactions() {
  const searchParams = useSearchParams();
  const overview = useOverview();
  if (!overview) return <Skeleton className="h-96 w-full" />;
  const filters = readFilters(searchParams, monthStart(overview.today));

  const end = monthEnd(filters.month);
  const month = overview.transactions.filter((t) => t.occurred_on >= filters.month && t.occurred_on <= end);
  const shown = filterTransactions(
    month,
    {
      type: filters.type as TransactionType | "all",
      accountId: filters.account || undefined,
      categoryId: filters.category || undefined,
      search: filters.q,
    },
    { categories: overview.categories, accounts: overview.accounts },
  );
  const { moneyIn, moneyOut } = inAndOut(shown, overview.openingBalanceId);

  const monthLink = (offset: number) => {
    const params = new URLSearchParams({ month: addMonths(filters.month, offset) });
    return `/transactions?${params}`;
  };
  const isCurrentMonth = filters.month === monthStart(overview.today);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="icon-lg" aria-label="Previous month">
          <Link href={monthLink(-1)}>
            <ChevronLeft />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{formatMonth(filters.month)}</h2>
        <Button
          asChild={!isCurrentMonth}
          variant="outline"
          size="icon-lg"
          aria-label="Next month"
          disabled={isCurrentMonth}
        >
          {isCurrentMonth ? <ChevronRight /> : (
            <Link href={monthLink(1)}>
              <ChevronRight />
            </Link>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card size="sm">
          <CardContent className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">In</span>
            <span className="text-xl font-bold text-income tabular-nums">{formatSignedPeso(moneyIn, "in")}</span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Out</span>
            <span className="text-xl font-bold text-expense tabular-nums">{formatSignedPeso(moneyOut, "out")}</span>
          </CardContent>
        </Card>
      </div>

      <TransactionFilters
        values={filters}
        accounts={overview.accounts}
        categories={overview.categories}
      />

      {shown.length > 0 ? (
        <TransactionList
          transactions={shown}
          accounts={overview.accounts}
          categories={overview.categories}
          today={overview.today}
        />
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {month.length === 0 ? "Nothing logged this month yet." : "No entries match these filters."}
        </p>
      )}
    </>
  );
}

export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transactions" description="Everything you logged, by day">
        <Button asChild size="lg" className="hidden md:inline-flex">
          <Link href="/add">
            <Plus /> Add entry
          </Link>
        </Button>
      </PageHeader>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Transactions />
      </Suspense>
    </>
  );
}
