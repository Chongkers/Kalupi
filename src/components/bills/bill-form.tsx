"use client";

import { useState, useTransition } from "react";
import { CategoryIcon } from "@/components/finance/category-icon";
import { inputClass, labelClass, selectClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { addMonths, formatDay, formatMonth, monthStart, type DateString } from "@/lib/dates";
import { dueDateIn, firstDueMonth, paymentsLeft, scheduleLabel } from "@/lib/finance/bills";
import { OPENING_BALANCE, type Category } from "@/lib/finance/types";
import type { BillRow } from "@/lib/local/db";
import { saveBill } from "@/lib/local/mutations";
import { toInputValue } from "@/lib/money";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Add or edit a monthly bill: what, how much, when, and (for installments) how many times. */
export function BillForm({
  initial,
  categories,
  accounts,
  today,
  onSaved,
}: {
  initial?: BillRow;
  categories: Category[];
  accounts: { id: string; name: string; archived: boolean }[];
  today: DateString;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [dueDay, setDueDay] = useState(initial?.due_day ?? Number(today.slice(8, 10)));
  // Follows the due day until the user picks a month themselves
  const [startsOn, setStartsOn] = useState<DateString | null>(initial?.starts_on ?? null);
  const [installments, setInstallments] = useState(!!initial?.ends_on);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const start = startsOn ?? firstDueMonth(dueDay, today);
  const months = Array.from({ length: 13 }, (_, i) => addMonths(monthStart(today), i - 1));
  if (!months.includes(start)) months.unshift(start);
  const choices = categories.filter(
    (c) => c.kind === "expense" && ((!c.archived_at && c.name !== OPENING_BALANCE) || c.id === initial?.category_id),
  );
  const paymentsDefault = initial?.ends_on ? String(paymentsLeft(initial, initial.starts_on, false)) : "";

  function submit(formData: FormData) {
    const get = (key: string) => String(formData.get(key) ?? "");
    startTransition(async () => {
      const result = await saveBill({
        id: initial?.id,
        name: get("name"),
        amount: get("amount"),
        categoryId,
        accountId: get("accountId"),
        dueDay,
        startsOn: start,
        payments: installments ? get("payments") : "",
      });
      setError(result.error);
      if (!result.error) onSaved();
    });
  }

  return (
    <form action={submit}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <Field>
            <FieldLabel htmlFor="bill-name" className={labelClass}>
              Bill
            </FieldLabel>
            <Input
              id="bill-name"
              name="name"
              placeholder="e.g. Rent, Wi-Fi, SPayLater"
              defaultValue={initial?.name}
              maxLength={40}
              required
              autoFocus
              className={inputClass}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bill-amount" className={labelClass}>
              Amount
            </FieldLabel>
            <span className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
              <Input
                id="bill-amount"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={initial ? toInputValue(initial.amount) : ""}
                required
                className={`${inputClass} pl-7`}
              />
            </span>
          </Field>
        </div>

        <Field>
          <FieldLabel className={labelClass}>Category</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                className="flex items-center gap-2 rounded-lg border border-input py-1.5 pr-3 pl-1.5 text-sm font-medium transition-colors hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                <CategoryIcon category={c} size="xs" />
                {c.name}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bill-day" className={labelClass}>
              Due every
            </FieldLabel>
            <NativeSelect
              id="bill-day"
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
              className="w-full"
              selectClassName={selectClass}
            >
              {DAYS.map((d) => (
                <NativeSelectOption key={d} value={d}>
                  {scheduleLabel(d).replace("Every ", "")} of the month
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="bill-start" className={labelClass}>
              First due
            </FieldLabel>
            <NativeSelect
              id="bill-start"
              value={start}
              onChange={(e) => setStartsOn(e.target.value)}
              className="w-full"
              selectClassName={selectClass}
            >
              {months.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {formatDay(dueDateIn(dueDay, m), today)} · {formatMonth(m)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="bill-account" className={labelClass}>
            Paid from
          </FieldLabel>
          <NativeSelect
            id="bill-account"
            name="accountId"
            defaultValue={initial?.account_id ?? ""}
            className="w-full"
            selectClassName={selectClass}
          >
            <NativeSelectOption value="">Pick when paying</NativeSelectOption>
            {accounts
              .filter((a) => !a.archived || a.id === initial?.account_id)
              .map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </Field>

        <Field>
          <div role="radiogroup" aria-label="How long" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {[
              { value: false, label: "Every month" },
              { value: true, label: "Installments" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={installments === option.value}
                onClick={() => setInstallments(option.value)}
                className="rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground transition-colors aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm"
              >
                {option.label}
              </button>
            ))}
          </div>
          {installments ? (
            <div className="flex items-center gap-3">
              <Input
                name="payments"
                inputMode="numeric"
                placeholder="6"
                defaultValue={paymentsDefault}
                aria-label="Number of payments"
                required
                className={`${inputClass} w-24`}
              />
              <span className="text-sm text-muted-foreground">payments, then it stops on its own</span>
            </div>
          ) : (
            <FieldDescription>Until you end it.</FieldDescription>
          )}
        </Field>

        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" disabled={isPending || !categoryId} className={submitClass}>
          {isPending ? "Saving…" : initial ? "Save changes" : "Add bill"}
        </Button>
      </FieldGroup>
    </form>
  );
}
