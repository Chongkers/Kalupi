// Warn before saving an expense that goes over a category limit, the month total,
// or the available balance (roadmap Phase 5). The user can still save; this only asks first.
import { formatPeso } from "@/lib/money";
import type { BudgetSummary } from "./budget";

export type GuardrailInput = {
  amount: number;
  categoryId: string;
  /** This month's budget; null when the expense is in another month or there is no budget */
  budget: BudgetSummary | null;
  available: number;
  /** When editing an expense: its saved amount and category, so it isn't counted twice */
  original?: { amount: number; categoryId: string | null; sameMonth: boolean } | null;
};

export function guardrailWarnings({ amount, categoryId, budget, available, original }: GuardrailInput): string[] {
  const warnings: string[] = [];
  const wasCounted = original?.sameMonth ? original.amount : 0;

  if (budget) {
    const line = budget.lines.find((l) => l.categoryId === categoryId);
    if (line) {
      const before = line.spent - (original?.categoryId === categoryId ? wasCounted : 0);
      const after = before + amount;
      if (after > line.limit) {
        warnings.push(`${line.name} goes over its ${formatPeso(line.limit)} limit by ${formatPeso(after - line.limit)}.`);
      }
    }

    const totalAfter = budget.totalSpent - wasCounted + amount;
    if (budget.totalLimit > 0 && totalAfter > budget.totalLimit) {
      warnings.push(
        `This month's spending goes over the ${formatPeso(budget.totalLimit)} budget by ${formatPeso(totalAfter - budget.totalLimit)}.`,
      );
    }
  }

  const availableBefore = available + (original ? original.amount : 0);
  if (amount > availableBefore) {
    warnings.push(`That's ${formatPeso(amount - availableBefore)} more than your available balance.`);
  }

  return warnings;
}
