import { dayOfMonth, type DateString } from "@/lib/dates";
import type { BudgetSummary } from "@/lib/finance/budget";
import { formatPeso } from "@/lib/money";
import { UsageBar } from "./budget-bar";

/** "71% used · ₱16,950 of ₱23,500" with the bar and a daily pace (mockup p.3 "All budgets"). */
export function BudgetTotal({ budget, today }: { budget: BudgetSummary; today: DateString }) {
  const { day, of } = dayOfMonth(today);
  const daysLeft = of - day + 1; // today counts
  const left = budget.totalLimit - budget.totalSpent;
  const over = left < 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-3xl font-bold tabular-nums">{budget.percentUsed}%</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatPeso(budget.totalSpent, { whole: true })} of {formatPeso(budget.totalLimit, { whole: true })}
        </span>
      </div>
      <UsageBar percent={budget.percentUsed} over={over} />
      <p className={over ? "text-sm font-medium text-expense" : "text-sm text-muted-foreground"}>
        {over
          ? `Over the monthly budget by ${formatPeso(-left, { whole: true })}.`
          : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left · about ${formatPeso(Math.floor(left / daysLeft), { whole: true })} a day keeps you on track`}
      </p>
    </div>
  );
}
