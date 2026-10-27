"use client";

import { useState, useTransition } from "react";
import { Check, Ellipsis, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/finance/category-icon";
import { amountInputClass, labelClass, selectClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatDay, type DateString } from "@/lib/dates";
import { dueLabel, type BillDue } from "@/lib/finance/bills";
import type { Category } from "@/lib/finance/types";
import { payBill, skipBill, undoBillPayment } from "@/lib/local/mutations";
import { formatPeso, toInputValue } from "@/lib/money";
import { cn } from "@/lib/utils";

type Accounts = { id: string; name: string; balance: number; archived: boolean }[];

/** Pay with a different amount or account than the bill's usual. */
export function PayBillDialog({
  due,
  accounts,
  onClose,
}: {
  due: BillDue | null;
  accounts: Accounts;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!due} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pay {due?.bill.name}</DialogTitle>
          <DialogDescription>Logged as an expense on {due ? formatDay(due.dueOn) : ""}.</DialogDescription>
        </DialogHeader>
        {due && <PayForm key={`${due.bill.id}:${due.month}`} due={due} accounts={accounts} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({ due, accounts, onDone }: { due: BillDue; accounts: Accounts; onDone: () => void }) {
  const active = accounts.filter((a) => !a.archived);
  const [amount, setAmount] = useState(toInputValue(due.bill.amount));
  const [accountId, setAccountId] = useState(
    active.some((a) => a.id === due.bill.account_id) ? due.bill.account_id! : (active[0]?.id ?? ""),
  );
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() =>
        startTransition(async () => {
          const result = await payBill(due.bill.id, due.month, { amount, accountId });
          setError(result.error);
          if (!result.error) {
            toast.success(`${due.bill.name} paid`);
            onDone();
          }
        })
      }
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pay-amount" className={cn(labelClass, "mx-auto")}>
            Amount
          </FieldLabel>
          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-bold text-expense">−₱</span>
            <Input
              id="pay-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn(amountInputClass, "max-w-48")}
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="pay-account" className={labelClass}>
            Paid from
          </FieldLabel>
          <NativeSelect
            id="pay-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full"
            selectClassName={selectClass}
          >
            {active.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name} · {formatPeso(a.balance)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
          {isPending ? "Saving…" : "Mark paid"}
        </Button>
      </FieldGroup>
    </form>
  );
}

const STATUS_CLASS: Record<BillDue["status"], string> = {
  overdue: "text-expense font-semibold",
  due: "text-expense font-semibold",
  upcoming: "text-muted-foreground",
  paid: "text-income",
  skipped: "text-muted-foreground",
};

/** One bill for one month: icon, name, when, amount, and the one-tap Paid button once it's due. */
export function BillDueRow({
  due,
  category,
  today,
  onPayDifferently,
}: {
  due: BillDue;
  category?: Category;
  today: DateString;
  onPayDifferently: (due: BillDue) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const settled = due.status === "paid" || due.status === "skipped";
  const run = (action: () => Promise<{ error?: string }>, done: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success(done);
    });

  return (
    <li className={cn("flex items-center gap-3 py-2.5", settled && "opacity-70")}>
      <CategoryIcon category={category ?? { name: due.bill.name }} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{due.bill.name}</span>
        <span className={cn("truncate text-xs", STATUS_CLASS[due.status])}>
          {dueLabel(due)}
          {due.status === "upcoming" && ` · ${formatDay(due.dueOn, today)}`}
        </span>
      </span>
      <span className={cn("font-semibold tabular-nums", settled && "line-through decoration-1")}>
        {formatPeso(due.bill.amount, { whole: true })}
      </span>

      {due.status === "due" || due.status === "overdue" ? (
        <Button size="sm" disabled={isPending} onClick={() => run(() => payBill(due.bill.id, due.month), `${due.bill.name} paid`)}>
          <Check /> Paid
        </Button>
      ) : settled ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Undo ${due.bill.name}`}
          title="Undo"
          disabled={isPending}
          onClick={() => run(() => undoBillPayment(due.payment!.id), "Undone")}
        >
          <Undo2 />
        </Button>
      ) : null}

      {!settled && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={`More for ${due.bill.name}`} disabled={isPending}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onPayDifferently(due)}>
              {due.status === "upcoming" ? "Pay now" : "Pay a different amount"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run(() => skipBill(due.bill.id, due.month), `${due.bill.name} skipped`)}>
              Skip this month
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
