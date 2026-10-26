"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert, Zap } from "lucide-react";
import { amountInputClass, inputClass, labelClass, selectClass, submitClass } from "@/components/form-styles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { monthStart, type DateString } from "@/lib/dates";
import type { BudgetSummary } from "@/lib/finance/budget";
import { guardrailWarnings } from "@/lib/finance/guardrail";
import { OPENING_BALANCE, type Category, type Transaction } from "@/lib/finance/types";
import type { PresetRow } from "@/lib/local/db";
import { saveTransaction } from "@/lib/local/mutations";
import { formatPeso, parsePeso, toInputValue } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

type FormType = "expense" | "income" | "transfer";

const TYPE_OPTIONS: { value: FormType; label: string }[] = [
  { value: "expense", label: "Out · Expense" },
  { value: "income", label: "In · Income" },
  { value: "transfer", label: "Transfer" },
];

export type TransactionFormProps = {
  accounts: { id: string; name: string; balance: number; archived: boolean }[];
  categories: Category[];
  /** For the guardrail */
  available: number;
  budget: BudgetSummary | null;
  today: DateString;
  /** Set when editing */
  initial?: Transaction;
  /** Amount read from a screenshot (Phase 10); fills the amount field and saves the entry as scanned */
  scannedAmount?: number | null;
  /** Saved entries to fill the form in one tap (new entries only) */
  presets?: PresetRow[];
};

export function TransactionForm({
  accounts,
  categories,
  available,
  budget,
  today,
  initial,
  scannedAmount,
  presets = [],
}: TransactionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string>();

  const [type, setType] = useState<FormType>((initial?.type as FormType) ?? "expense");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [clientError, setClientError] = useState<string>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const pendingData = useRef<FormData | null>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const accountSelect = useRef<HTMLSelectElement>(null);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const [presetId, setPresetId] = useState<string | null>(null);

  // A new scan result replaces whatever is in the amount field; the rest of the form stays as is
  useEffect(() => {
    if (scannedAmount && amountInput.current) amountInput.current.value = toInputValue(scannedAmount);
  }, [scannedAmount]);

  // Archived accounts and categories stay selectable only if this entry already uses them
  const activeAccounts = accounts.filter(
    (a) => !a.archived || a.id === initial?.account_id || a.id === initial?.to_account_id,
  );
  const choices = categories.filter(
    (c) =>
      c.kind === type &&
      ((!c.archived_at && c.name !== OPENING_BALANCE) || c.id === initial?.category_id),
  );

  // Saves on this device right away; sync sends it to the server when online
  function submit(formData: FormData) {
    const get = (key: string) => String(formData.get(key) ?? "");
    startTransition(async () => {
      const result = await saveTransaction({
        id: get("id") || undefined,
        type: get("type"),
        amount: get("amount"),
        accountId: get("accountId"),
        toAccountId: get("toAccountId"),
        categoryId: get("categoryId"),
        occurredOn: get("occurredOn"),
        note: get("note"),
        source: scannedAmount ? "scan" : presetId ? "preset" : "manual",
      });
      if (result.error) setSaveError(result.error);
      else router.push("/transactions");
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = parsePeso(String(formData.get("amount") ?? ""));

    if (amount === null) return setClientError("Enter an amount, like 250 or 1,250.50.");
    if (type !== "transfer" && !categoryId) return setClientError("Pick a category.");
    setClientError(undefined);

    if (type === "expense") {
      const date = String(formData.get("occurredOn"));
      const inThisMonth = monthStart(date) === monthStart(today);
      const wasExpense = initial?.type === "expense";
      const found = guardrailWarnings({
        amount,
        categoryId,
        budget: inThisMonth ? budget : null,
        available,
        original: wasExpense
          ? {
              amount: initial.amount,
              categoryId: initial.category_id,
              sameMonth: monthStart(initial.occurred_on) === monthStart(today),
            }
          : null,
      });
      if (found.length > 0) {
        pendingData.current = formData;
        return setWarnings(found);
      }
    }
    submit(formData);
  }

  const error = clientError ?? saveError;

  // Presets for this type; tapping one fills the form, and everything stays editable before saving
  const typePresets = initial ? [] : presets.filter((p) => p.type === type && !p.archived_at);
  function applyPreset(preset: PresetRow) {
    setPresetId(preset.id);
    if (preset.category_id) setCategoryId(preset.category_id);
    if (amountInput.current) amountInput.current.value = toInputValue(preset.amount);
    if (noteInput.current) noteInput.current.value = preset.name;
    if (preset.account_id && accountSelect.current && activeAccounts.some((a) => a.id === preset.account_id)) {
      accountSelect.current.value = preset.account_id;
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {initial && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="categoryId" value={type === "transfer" ? "" : categoryId} />

        {/* Type switch (mockup p.11) */}
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={type === option.value}
              onClick={() => {
                setType(option.value);
                setCategoryId("");
                setPresetId(null);
              }}
              className="rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground transition-colors aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm"
            >
              {option.label}
            </button>
          ))}
        </div>

        {typePresets.length > 0 && (
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Zap className="size-3.5 text-primary" /> Presets
            </span>
            {typePresets.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={presetId === p.id}
                onClick={() => applyPreset(p)}
                className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary/10"
              >
                {p.name}
                <span className="text-muted-foreground tabular-nums">{formatPeso(p.amount, { whole: true })}</span>
              </button>
            ))}
          </div>
        )}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="amount" className={cn(labelClass, "mx-auto")}>
              Amount
            </FieldLabel>
            <div className="flex items-center justify-center gap-1">
              <span
                className={cn(
                  "text-3xl font-bold",
                  type === "expense" && "text-expense",
                  type === "income" && "text-income",
                )}
              >
                {type === "expense" ? "−₱" : type === "income" ? "+₱" : "₱"}
              </span>
              <Input
                ref={amountInput}
                id="amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                defaultValue={initial ? toInputValue(initial.amount) : ""}
                autoFocus={!initial}
                required
                className={cn(amountInputClass, "max-w-56")}
              />
            </div>
          </Field>

          {type !== "transfer" && (
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
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="accountId" className={labelClass}>
                {type === "transfer" ? "From" : type === "income" ? "Into" : "Paid from"}
              </FieldLabel>
              <NativeSelect
                ref={accountSelect}
                id="accountId"
                name="accountId"
                defaultValue={initial?.account_id ?? activeAccounts[0]?.id}
                className="w-full"
                selectClassName={selectClass}
              >
                {activeAccounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name} · {formatPeso(a.balance)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            {type === "transfer" ? (
              <Field>
                <FieldLabel htmlFor="toAccountId" className={labelClass}>
                  To
                </FieldLabel>
                <NativeSelect
                  id="toAccountId"
                  name="toAccountId"
                  defaultValue={initial?.to_account_id ?? activeAccounts[1]?.id ?? ""}
                  className="w-full"
                  selectClassName={selectClass}
                >
                  {activeAccounts.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="occurredOn" className={labelClass}>
                  Date
                </FieldLabel>
                <Input
                  id="occurredOn"
                  name="occurredOn"
                  type="date"
                  defaultValue={initial?.occurred_on ?? today}
                  required
                  className={inputClass}
                />
              </Field>
            )}
          </div>

          {type === "transfer" && (
            <Field>
              <FieldLabel htmlFor="occurredOn" className={labelClass}>
                Date
              </FieldLabel>
              <Input
                id="occurredOn"
                name="occurredOn"
                type="date"
                defaultValue={initial?.occurred_on ?? today}
                required
                className={inputClass}
              />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="note" className={labelClass}>
              Note (optional)
            </FieldLabel>
            <Textarea
              ref={noteInput}
              id="note"
              name="note"
              maxLength={200}
              placeholder={type === "expense" ? "e.g. Market run" : "Add a note"}
              defaultValue={initial?.note ?? ""}
              className="min-h-20 bg-secondary text-base"
            />
          </Field>

          <FieldError>{error}</FieldError>

          <Button type="submit" size="lg" disabled={isPending || activeAccounts.length === 0} className={submitClass}>
            {isPending ? "Saving…" : initial ? "Save changes" : `Save ${type}`}
          </Button>
        </FieldGroup>
      </form>

      {/* Guardrail (Phase 5): ask before going over */}
      <AlertDialog open={warnings.length > 0} onOpenChange={(open) => !open && setWarnings([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-expense" /> Over budget
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-left">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingData.current) submit(pendingData.current);
                setWarnings([]);
              }}
            >
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
