"use client";

import { useState, useTransition } from "react";
import { inputClass, labelClass, selectClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PresetRow } from "@/lib/local/db";
import { OPENING_BALANCE, type Category } from "@/lib/finance/types";
import { savePreset } from "@/lib/local/mutations";
import { toInputValue } from "@/lib/money";

type PresetType = "expense" | "income" | "contribution";

const TYPES: { value: PresetType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "contribution", label: "Tracker" },
];

/** A saved entry for one-tap logging, e.g. "Jeep fare · ₱13 · Transportation". */
export function PresetForm({
  initial,
  categories,
  accounts,
  trackers,
  onSaved,
}: {
  initial?: PresetRow;
  categories: Category[];
  accounts: { id: string; name: string; archived: boolean }[];
  trackers: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [type, setType] = useState<PresetType>((initial?.type as PresetType) ?? "expense");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const choices = categories.filter(
    (c) => c.kind === type && ((!c.archived_at && c.name !== OPENING_BALANCE) || c.id === initial?.category_id),
  );

  function submit(formData: FormData) {
    const get = (key: string) => String(formData.get(key) ?? "");
    startTransition(async () => {
      const result = await savePreset({
        id: initial?.id,
        name: get("name"),
        type,
        amount: get("amount"),
        accountId: get("accountId"),
        categoryId,
        trackerId: get("trackerId"),
      });
      setError(result.error);
      if (!result.error) onSaved();
    });
  }

  return (
    <form action={submit}>
      <FieldGroup>
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={type === option.value}
              onClick={() => {
                setType(option.value);
                setCategoryId("");
              }}
              className="rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground transition-colors aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <Field>
            <FieldLabel htmlFor="preset-name" className={labelClass}>
              Name
            </FieldLabel>
            <Input
              id="preset-name"
              name="name"
              placeholder="e.g. Jeep fare"
              defaultValue={initial?.name}
              maxLength={40}
              required
              autoFocus
              className={inputClass}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="preset-amount" className={labelClass}>
              Amount
            </FieldLabel>
            <span className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
              <Input
                id="preset-amount"
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

        {type === "contribution" ? (
          <Field>
            <FieldLabel htmlFor="preset-tracker" className={labelClass}>
              Tracker
            </FieldLabel>
            {trackers.length > 0 ? (
              <NativeSelect
                id="preset-tracker"
                name="trackerId"
                defaultValue={initial?.tracker_id ?? trackers[0].id}
                className="w-full"
                selectClassName={selectClass}
              >
                {trackers.map((t) => (
                  <NativeSelectOption key={t.id} value={t.id}>
                    {t.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <FieldDescription>Create a tracker first.</FieldDescription>
            )}
          </Field>
        ) : (
          <Field>
            <FieldLabel className={labelClass}>Category</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={categoryId === c.id}
                  onClick={() => setCategoryId(c.id)}
                  className="rounded-lg border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="preset-account" className={labelClass}>
            Account
          </FieldLabel>
          <NativeSelect
            id="preset-account"
            name="accountId"
            defaultValue={initial?.account_id ?? ""}
            className="w-full"
            selectClassName={selectClass}
          >
            <NativeSelectOption value="">Pick when logging</NativeSelectOption>
            {accounts
              .filter((a) => !a.archived || a.id === initial?.account_id)
              .map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </Field>

        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
          {isPending ? "Saving…" : initial ? "Save changes" : "Create preset"}
        </Button>
      </FieldGroup>
    </form>
  );
}
