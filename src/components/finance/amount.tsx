import type { TransactionType } from "@/lib/finance/types";
import { formatPeso, formatSignedPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

/** A transaction amount, signed and colored by type: income green "+", expense red "−", transfers neutral. */
export function Amount({
  type,
  amount,
  whole,
  className,
}: {
  type: TransactionType;
  amount: number;
  whole?: boolean;
  className?: string;
}) {
  const text =
    type === "income"
      ? formatSignedPeso(amount, "in", { whole })
      : type === "expense"
        ? formatSignedPeso(amount, "out", { whole })
        : formatPeso(amount, { whole });

  return (
    <span
      className={cn(
        "font-semibold tabular-nums whitespace-nowrap",
        type === "income" && "text-income",
        type === "expense" && "text-expense",
        className,
      )}
    >
      {text}
    </span>
  );
}
