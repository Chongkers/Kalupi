"use client";

import { PageHeader } from "@/components/page-header";
import { BudgetBar } from "@/components/finance/budget-bar";
import { BudgetTotal } from "@/components/finance/budget-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonth, monthStart } from "@/lib/dates";
import { useOverview, type Overview } from "@/lib/local/hooks";
import { BudgetForm } from "./budget-form";

function Budget({ overview }: { overview: Overview }) {
  const { budget, monthBudget, categories, today } = overview;

  const limits = new Map(monthBudget?.items.map((i) => [i.category_id, i.limit_amount]));
  const rows = categories
    .filter((c) => c.kind === "expense" && (!c.archived_at || limits.has(c.id)))
    .map((c) => ({ categoryId: c.id, name: c.name, limit: limits.get(c.id) ?? 0 }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">This month</CardTitle>
            <CardDescription>{formatMonth(monthStart(today))}</CardDescription>
          </CardHeader>
          <CardContent>
            {budget && budget.totalLimit > 0 ? (
              <BudgetTotal budget={budget} today={today} />
            ) : (
              <p className="text-muted-foreground">No limits yet. Set some below to start tracking.</p>
            )}
          </CardContent>
        </Card>

        {budget && budget.lines.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">By category</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {budget.lines.map((line) => (
                <BudgetBar key={line.categoryId} line={line} showLeft />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Edit limits</CardTitle>
          <CardDescription>Leave a category blank for no limit, or set one overall limit.</CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetForm
            key={monthBudget?.id ?? "none"}
            month={monthStart(today)}
            rows={rows}
            totalLimit={monthBudget?.totalLimit ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function BudgetsPage() {
  const overview = useOverview();
  return (
    <>
      <PageHeader title="Budget" description="This month's limits" />
      {overview ? <Budget overview={overview} /> : <Skeleton className="h-96 w-full" />}
    </>
  );
}
