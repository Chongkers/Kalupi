// Row shapes the finance helpers work on. They match the Supabase tables (docs/erd.md),
// so the same helpers can run on Dexie rows once offline sync lands (Phase 6).
import type { DateString } from "@/lib/dates";

export type AccountKind = "cash" | "bank" | "ewallet";
export type CategoryKind = "income" | "expense";
/** settle_in / settle_out: a friend paid you back, or you paid them back (v1.0.2). Not income or spending. */
export type TransactionType = "income" | "expense" | "contribution" | "withdrawal" | "transfer" | "settle_in" | "settle_out";
/** goal = saving up toward a target; split = settling up after an event (v1.0.2) */
export type TrackerKind = "goal" | "split";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  archived_at: string | null;
};

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  archived_at: string | null;
  icon?: string | null;
  color?: string | null;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  /** Centavos, always positive; `type` gives the direction */
  amount: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  tracker_id: string | null;
  occurred_on: DateString;
  note: string | null;
  source: "manual" | "preset" | "scan";
  created_at: string;
};

export type BudgetItem = {
  id: string;
  category_id: string;
  limit_amount: number;
};

/** The income category the setup wizard records starting balances in. Created by the sign-up trigger. */
export const OPENING_BALANCE = "Opening balance";

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  cash: "Cash",
  bank: "Bank",
  ewallet: "E-wallet",
};
