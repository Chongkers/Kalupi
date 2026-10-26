import { formatPeso } from "@/lib/money";
import type { BudgetLine } from "@/lib/finance/budget";
import type { Category } from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

/** Mockup budget row: icon, name, "₱6,200 of ₱8,000" (or "Over by ₱450"), and a bar that turns red when over. */
export function BudgetBar({ line, showLeft, category }: { line: BudgetLine; showLeft?: boolean; category?: Category }) {
  const percent = line.limit > 0 ? Math.min(100, (line.spent / line.limit) * 100) : line.spent > 0 ? 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <CategoryIcon category={category ?? { name: line.name }} size="xs" />
          <span className="truncate font-medium">{line.name}</span>
        </span>
        <span className={cn("shrink-0 tabular-nums", line.over ? "font-semibold text-expense" : "text-muted-foreground")}>
          {line.over
            ? `${showLeft ? `${formatPeso(line.spent, { whole: true })} of ${formatPeso(line.limit, { whole: true })} · ` : ""}Over by ${formatPeso(-line.remaining, { whole: true })}`
            : `${formatPeso(line.spent, { whole: true })} of ${formatPeso(line.limit, { whole: true })}${showLeft ? ` · ${formatPeso(line.remaining, { whole: true })} left` : ""}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", line.over ? "bg-expense" : "bg-primary")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** The plain bar, for the month total. */
export function UsageBar({ percent, over }: { percent: number; over?: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", over ? "bg-expense" : "bg-primary")}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}
