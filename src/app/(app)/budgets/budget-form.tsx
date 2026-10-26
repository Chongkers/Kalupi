"use client";

import { useState, useTransition } from "react";
import { Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { inputClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { DateString } from "@/lib/dates";
import { formatPeso, parseOptionalPeso, toInputValue } from "@/lib/money";
import { saveBudget } from "@/lib/local/mutations";
import type { Category } from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/finance/category-icon";

type Row = { categoryId: string; name: string; limit: number; category?: Category };
type Draft = { key: string; name: string; amount: string };

function PesoInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <span className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
      <Input inputMode="decimal" className={`${inputClass} pl-7 text-right`} {...props} />
    </span>
  );
}

/**
 * Limits per category, plus an optional overall limit for the month. Without the overall limit,
 * the month's budget is the sum of the category limits.
 */
export function BudgetForm({
  month,
  rows,
  totalLimit,
  showTemplateSwitch = true,
}: {
  /** First day of the month being edited */
  month: DateString;
  rows: Row[];
  /** The month's custom overall limit, or null */
  totalLimit: number | null;
  /** Off for past months: editing history shouldn't change future months by default */
  showTemplateSwitch?: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.categoryId, toInputValue(r.limit)])),
  );
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [overall, setOverall] = useState(() => toInputValue(totalLimit ?? 0));
  // Rows added after the form opened (e.g. a custom limit just saved) start from their saved limit
  const valueOf = (row: Row) => values[row.categoryId] ?? toInputValue(row.limit);
  const updateDraft = (key: string, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const [useOverall, setUseOverall] = useState(totalLimit !== null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveBudget({
        month,
        limits: rows.map((r) => ({ categoryId: r.categoryId, amount: valueOf(r) })),
        totalLimit: useOverall ? overall : "",
        alsoTemplate: showTemplateSwitch && formData.get("alsoTemplate") === "on",
        newCategories: drafts,
      });
      setError(result.error);
      if (!result.error) {
        toast.success(drafts.length > 0 ? "Budget saved. Your custom limits are now categories too." : "Budget saved");
        setDrafts([]);
      }
    });
  }

  const categorySum = [...rows.map(valueOf), ...drafts.map((d) => d.amount)].reduce(
    (sum, v) => sum + (parseOptionalPeso(v) ?? 0),
    0,
  );
  const overallValue = parseOptionalPeso(overall) ?? 0;
  const unplanned = useOverall && overallValue > 0 ? overallValue - categorySum : null;

  return (
    // @container: the category list goes two-across when the form is wide (Budget page), one on phones and History
    <form action={save} className="@container flex flex-col gap-4">
      {/* Custom overall limit */}
      <div className="flex flex-col gap-3 rounded-xl border p-3">
        <label className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <span className="font-medium">Set my own monthly limit</span>
            <span className="text-sm text-muted-foreground">
              {useOverall ? "One total for the month, whatever the categories add up to." : "Off: the total is the sum of the categories."}
            </span>
          </span>
          <Switch checked={useOverall} onCheckedChange={setUseOverall} aria-label="Set my own monthly limit" />
        </label>
        {useOverall && (
          <>
            <PesoInput
              name="totalLimit"
              placeholder="e.g. 20000"
              value={overall}
              onChange={(e) => setOverall(e.target.value)}
              aria-label="Monthly limit"
              autoFocus
            />
            {unplanned !== null && (
              <p className={cn("text-sm", unplanned < 0 ? "text-expense" : "text-muted-foreground")}>
                {unplanned >= 0
                  ? `${formatPeso(unplanned, { whole: true })} of it isn't assigned to a category.`
                  : `The categories add up to ${formatPeso(-unplanned, { whole: true })} more than this limit.`}
              </p>
            )}
          </>
        )}
      </div>

      <ul className="grid @xl:grid-cols-2 @xl:gap-x-8">
        {rows.map((row) => (
          <li key={row.categoryId} className="border-b">
            <label className="flex items-center justify-between gap-4 py-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <CategoryIcon category={row.category ?? { name: row.name }} size="sm" />
                <span className="truncate font-medium">{row.name}</span>
              </span>
              <PesoInput
                name={`limit:${row.categoryId}`}
                placeholder="No limit"
                value={valueOf(row)}
                onChange={(e) => setValues((v) => ({ ...v, [row.categoryId]: e.target.value }))}
                className="w-32 shrink-0"
              />
            </label>
          </li>
        ))}
        {drafts.map((draft) => (
          <li key={draft.key} className="flex items-center gap-2 border-b py-3 @xl:col-span-2">
            <span className="relative min-w-0 flex-1">
              <Tag className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
              <Input
                value={draft.name}
                onChange={(e) => updateDraft(draft.key, { name: e.target.value })}
                placeholder="e.g. Milk tea"
                maxLength={40}
                aria-label="Custom limit name"
                autoFocus
                className={`${inputClass} pl-9`}
              />
            </span>
            <PesoInput
              value={draft.amount}
              onChange={(e) => updateDraft(draft.key, { amount: e.target.value })}
              placeholder="Limit"
              aria-label={`Limit for ${draft.name || "custom limit"}`}
              className="w-32 shrink-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove custom limit"
              onClick={() => setDrafts((list) => list.filter((d) => d.key !== draft.key))}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => setDrafts((list) => [...list, { key: crypto.randomUUID(), name: "", amount: "" }])}
      >
        <Plus /> Add a custom limit
      </Button>
      {drafts.length > 0 && (
        <p className="-mt-2 text-sm text-muted-foreground">
          Each one becomes an expense category you can pick when logging, with its own limit.
        </p>
      )}

      <div className="flex flex-col gap-1 border-t pt-3">
        <div className="flex items-center justify-between font-semibold">
          <span>Total per month</span>
          <span className="tabular-nums">{formatPeso(useOverall && overallValue > 0 ? overallValue : categorySum)}</span>
        </div>
        {useOverall && overallValue > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Categories add up to</span>
            <span className="tabular-nums">{formatPeso(categorySum)}</span>
          </div>
        )}
      </div>

      {showTemplateSwitch && (
        <label className="flex items-center justify-between gap-4 rounded-xl bg-secondary p-3">
          <span className="flex flex-col">
            <span className="font-medium">Use for future months too</span>
            <span className="text-sm text-muted-foreground">New months start from these limits.</span>
          </span>
          <Switch name="alsoTemplate" defaultChecked />
        </label>
      )}

      <FieldError>{error}</FieldError>

      <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
        {isPending ? "Saving…" : "Save budget"}
      </Button>
    </form>
  );
}
