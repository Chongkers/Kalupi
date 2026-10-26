"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Goal, HandCoins } from "lucide-react";
import { inputClass, labelClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TrackerKind } from "@/lib/finance/types";
import { saveTracker } from "@/lib/local/mutations";
import { toInputValue } from "@/lib/money";

const KINDS: { kind: TrackerKind; icon: typeof Goal; title: string; description: string }[] = [
  {
    kind: "split",
    icon: HandCoins,
    title: "Settling up after an event",
    description: "A night out, a trip, a group gift. Split the bills and see who owes what.",
  },
  {
    kind: "goal",
    icon: Goal,
    title: "Saving up for something",
    description: "A trip, a new phone. Set a target and save toward it, with a friend if you like.",
  },
];

/** The first question for a new tracker. */
export function TrackerKindPicker({ onPick }: { onPick: (kind: TrackerKind) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {KINDS.map(({ kind, icon: Icon, title, description }) => (
        <button
          key={kind}
          type="button"
          onClick={() => onPick(kind)}
          className="flex items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-accent"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold">{title}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

/** Create or edit a tracker. Saving: name, target, optional date. Settling up: name, optional date. */
export function TrackerForm({
  kind = "goal",
  initial,
  onSaved,
}: {
  kind?: TrackerKind;
  initial?: { id: string; name: string; target_amount: number | null; target_date: string | null };
  onSaved: (id: string) => void;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const isSplit = kind === "split";

  function submit(formData: FormData) {
    const get = (key: string) => String(formData.get(key) ?? "");
    startTransition(async () => {
      const result = await saveTracker({
        id: initial?.id,
        kind,
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
            {isSplit ? "Event" : "Name"}
          </FieldLabel>
          <Input
            id="tracker-name"
            name="name"
            placeholder={isSplit ? "e.g. Boracay trip, Friday dinners" : "e.g. Baguio trip"}
            defaultValue={initial?.name}
            maxLength={60}
            required
            autoFocus
            className={inputClass}
          />
        </Field>
        {isSplit ? (
          <Field>
            <FieldLabel htmlFor="tracker-date" className={labelClass}>
              When (optional)
            </FieldLabel>
            <Input id="tracker-date" name="targetDate" type="date" defaultValue={initial?.target_date ?? ""} className={inputClass} />
            <FieldDescription>You&apos;ll add the people and bills next. Friends don&apos;t need the app.</FieldDescription>
          </Field>
        ) : (
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
                  defaultValue={initial?.target_amount ? toInputValue(initial.target_amount) : ""}
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
        )}
        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
          {isPending ? "Saving…" : initial ? "Save changes" : "Create tracker"}
        </Button>
      </FieldGroup>
    </form>
  );
}
