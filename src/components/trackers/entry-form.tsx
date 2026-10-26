"use client";

import { useState, useTransition } from "react";
import { amountInputClass, inputClass, labelClass, selectClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { DateString } from "@/lib/dates";
import type { Transaction } from "@/lib/finance/types";
import { saveTrackerEntry } from "@/lib/local/mutations";
import { formatPeso, toInputValue } from "@/lib/money";
import { cn } from "@/lib/utils";

type EntryType = "contribution" | "withdrawal";

/** Add money to a tracker or take it back, from one of your accounts. */
export function EntryForm({
  trackerId,
  accounts,
  available,
  myNet,
  today,
  initial,
  defaultType = "contribution",
  onSaved,
}: {
  trackerId: string;
  accounts: { id: string; name: string; balance: number; archived: boolean }[];
  /** Available to spend, shown so nobody sets aside money they don't have */
  available: number;
  /** What you've put in so far, the most you can withdraw */
  myNet: number;
  today: DateString;
  initial?: Transaction;
  defaultType?: EntryType;
  onSaved: () => void;
}) {
  const [type, setType] = useState<EntryType>((initial?.type as EntryType) ?? defaultType);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const choices = accounts.filter((a) => !a.archived || a.id === initial?.account_id);

  function submit(formData: FormData) {
    const get = (key: string) => String(formData.get(key) ?? "");
    startTransition(async () => {
      const result = await saveTrackerEntry({
        id: initial?.id,
        trackerId,
        type,
        amount: get("amount"),
        accountId: get("accountId"),
        occurredOn: get("occurredOn"),
        note: get("note"),
      });
      setError(result.error);
      if (!result.error) onSaved();
    });
  }

  // When editing, the entry's own amount is already counted in these
  const room =
    type === "contribution"
      ? available + (initial?.type === "contribution" ? initial.amount : 0)
      : myNet + (initial?.type === "withdrawal" ? initial.amount : 0) - (initial?.type === "contribution" ? initial.amount : 0);

  return (
    <form action={submit}>
      <FieldGroup>
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["contribution", "withdrawal"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className="rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground transition-colors aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm"
            >
              {value === "contribution" ? "Add money" : "Withdraw"}
            </button>
          ))}
        </div>

        <Field>
          <FieldLabel htmlFor="entry-amount" className={cn(labelClass, "mx-auto")}>
            Amount
          </FieldLabel>
          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-bold">₱</span>
            <Input
              id="entry-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              defaultValue={initial ? toInputValue(initial.amount) : ""}
              autoFocus
              required
              className={cn(amountInputClass, "max-w-48")}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {type === "contribution" ? `${formatPeso(room)} available to set aside` : `You can withdraw up to ${formatPeso(Math.max(0, room))}`}
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="entry-account" className={labelClass}>
              {type === "contribution" ? "From" : "Back to"}
            </FieldLabel>
            <NativeSelect
              id="entry-account"
              name="accountId"
              defaultValue={initial?.account_id ?? choices[0]?.id}
              className="w-full"
              selectClassName={selectClass}
            >
              {choices.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name} · {formatPeso(a.balance)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="entry-date" className={labelClass}>
              Date
            </FieldLabel>
            <Input id="entry-date" name="occurredOn" type="date" defaultValue={initial?.occurred_on ?? today} required className={inputClass} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="entry-note" className={labelClass}>
            Note (optional)
          </FieldLabel>
          <Input id="entry-note" name="note" maxLength={200} defaultValue={initial?.note ?? ""} className={inputClass} />
        </Field>

        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" disabled={isPending || choices.length === 0} className={submitClass}>
          {isPending ? "Saving…" : initial ? "Save changes" : type === "contribution" ? "Add to tracker" : "Withdraw"}
        </Button>
      </FieldGroup>
    </form>
  );
}
