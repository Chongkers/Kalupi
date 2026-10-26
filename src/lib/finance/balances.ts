// Balances are derived from transactions, never stored (docs/erd.md, "Derived values").
import type { Transaction } from "./types";

type BalanceInput = Pick<Transaction, "type" | "amount" | "account_id" | "to_account_id">;

/** Account id → balance in centavos: income − expense + transfers in − transfers out. */
export function accountBalances(transactions: BalanceInput[]): Map<string, number> {
  const balances = new Map<string, number>();
  const add = (accountId: string, delta: number) => balances.set(accountId, (balances.get(accountId) ?? 0) + delta);

  for (const t of transactions) {
    switch (t.type) {
      case "income":
        add(t.account_id, t.amount);
        break;
      case "expense":
        add(t.account_id, -t.amount);
        break;
      case "transfer":
        add(t.account_id, -t.amount);
        if (t.to_account_id) add(t.to_account_id, t.amount);
        break;
      // Contributions and withdrawals earmark money for a tracker; it stays in the account
    }
  }
  return balances;
}

/** Sum of every account balance minus what's earmarked for trackers (contributions − withdrawals). */
export function availableBalance(transactions: BalanceInput[]): number {
  let total = 0;
  for (const balance of accountBalances(transactions).values()) total += balance;

  for (const t of transactions) {
    if (t.type === "contribution") total -= t.amount;
    if (t.type === "withdrawal") total += t.amount;
  }
  return total;
}
