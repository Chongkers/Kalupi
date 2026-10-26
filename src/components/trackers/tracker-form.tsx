"use client";

import { useState, useTransition } from "react";
import { inputClass, labelClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveTracker } from "@/lib/local/mutations";
import { toInputValue } from "@/lib/money";

/** Create or edit a tracker: name, target, optional date. */
export function TrackerForm({
  initial,
  onSaved,
}: {
  initial?: { id: string; name: string; target_amount: number; target_date: string | null };
  onSaved: (id: string) => void;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const get = (key: string) => String(formData.get(key) ?? "");
    startTransition(async () => {
      const result = await saveTracker({
        id: initial?.id,
        name: get("name"),
        target: get("target"),
        targetDate: get("targetDate"),
      });
      setError(result.error);
      if (!result.error && result.id) onSaved(result.id);
    });
  }

  return (
    <form action={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="tracker-name" className={labelClass}>
            Name
          </FieldLabel>
          <Input
            id="tracker-name"
            name="name"
            placeholder="e.g. Baguio trip"
            defaultValue={initial?.name}
            maxLength={60}
            required
            autoFocus
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="tracker-target" className={labelClass}>
              Target
            </FieldLabel>
            <span className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
              <Input
                id="tracker-target"
                name="target"
                inputMode="decimal"
                placeholder="20000"
                defaultValue={initial ? toInputValue(initial.target_amount) : ""}
                required
                className={`${inputClass} pl-7`}
              />
            </span>
          </Field>
          <Field>
            <FieldLabel htmlFor="tracker-date" className={labelClass}>
              By (optional)
            </FieldLabel>
            <Input id="tracker-date" name="targetDate" type="date" defaultValue={initial?.target_date ?? ""} className={inputClass} />
          </Field>
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
          {isPending ? "Saving…" : initial ? "Save changes" : "Create tracker"}
        </Button>
      </FieldGroup>
    </form>
  );
}
