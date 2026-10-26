import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, PiggyBank } from "lucide-react";
import { formatDay, type DateString } from "@/lib/dates";
import { groupByDay } from "@/lib/finance/list";
import type { Transaction } from "@/lib/finance/types";
import { Amount } from "./amount";

type Named = { id: string; name: string };

const ICONS = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
  contribution: PiggyBank,
  withdrawal: PiggyBank,
};

/** Day-grouped rows (mockup p.10 "Recent"), each linking to its edit page. */
export function TransactionList({
  transactions,
  accounts,
  categories,
  today,
  grouped = true,
}: {
  transactions: Transaction[];
  accounts: Named[];
  categories: Named[];
  today: DateString;
  grouped?: boolean;
}) {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const row = (t: Transaction) => {
    const Icon = ICONS[t.type];
    const category = t.category_id ? categoryName.get(t.category_id) : undefined;
    const title =
      t.note ||
      category ||
      { transfer: "Transfer", contribution: "Added to a tracker", withdrawal: "Withdrew from a tracker" }[t.type as string] ||
      "Entry";
    const where =
      t.type === "transfer"
        ? `${accountName.get(t.account_id)} → ${t.to_account_id ? accountName.get(t.to_account_id) : ""}`
        : accountName.get(t.account_id);
    const details = [grouped ? null : formatDay(t.occurred_on, today), t.note ? category : null, where]
      .filter(Boolean)
      .join(" · ");

    return (
      <li key={t.id}>
        <Link href={`/transactions/edit?id=${t.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{title}</span>
            <span className="truncate text-sm text-muted-foreground">{details}</span>
          </span>
          <Amount type={t.type} amount={t.amount} />
        </Link>
      </li>
    );
  };

  if (!grouped) {
    return <ul className="divide-y overflow-hidden rounded-xl border bg-card">{transactions.map(row)}</ul>;
  }

  return (
    <div className="flex flex-col gap-4">
      {groupByDay(transactions).map((group) => (
        <section key={group.date} className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatDay(group.date, today)}
          </h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">{group.items.map(row)}</ul>
        </section>
      ))}
    </div>
  );
}
