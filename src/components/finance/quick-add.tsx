"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, TriangleAlert, Zap } from "lucide-react";
import { amountInputClass, labelClass, selectClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { guardrailWarnings } from "@/lib/finance/guardrail";
import { getMeta, setMeta, type PresetRow } from "@/lib/local/db";
import { useTrackers, type Overview } from "@/lib/local/hooks";
import { logPreset } from "@/lib/local/mutations";
import { formatPeso, parsePeso, toInputValue } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { PresetForm } from "./preset-form";

/** The confirm sheet: amount and account can change; it's logged for today. */
function LogPreset({ preset, overview, onDone }: { preset: PresetRow; overview: Overview; onDone: () => void }) {
  const accounts = overview.accounts.filter((a) => !a.archived);
  const [amount, setAmount] = useState(toInputValue(preset.amount));
  const [accountId, setAccountId] = useState(
    accounts.some((a) => a.id === preset.account_id) ? preset.account_id! : (accounts[0]?.id ?? ""),
  );
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const cents = parsePeso(amount);
  const warnings =
    preset.type === "expense" && cents && preset.category_id
      ? guardrailWarnings({ amount: cents, categoryId: preset.category_id, budget: overview.budget, available: overview.available })
      : [];

  return (
    <form
      action={() =>
        startTransition(async () => {
          const result = await logPreset(preset.id, amount, accountId);
          setError(result.error);
          if (!result.error) {
            toast.success(`Logged ${preset.name}`);
            onDone();
          }
        })
      }
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="quick-amount" className={cn(labelClass, "mx-auto")}>
            Amount
          </FieldLabel>
          <div className="flex items-center justify-center gap-1">
            <span className={cn("text-3xl font-bold", preset.type === "expense" && "text-expense", preset.type === "income" && "text-income")}>
              {preset.type === "expense" ? "−₱" : preset.type === "income" ? "+₱" : "₱"}
            </span>
            <Input
              id="quick-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn(amountInputClass, "max-w-48")}
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="quick-account" className={labelClass}>
            {preset.type === "income" ? "Into" : "From"}
          </FieldLabel>
          <NativeSelect
            id="quick-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full"
            selectClassName={selectClass}
          >
            {accounts.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name} · {formatPeso(a.balance)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {warnings.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-xl bg-expense/10 p-3 text-sm text-expense">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
              </li>
            ))}
          </ul>
        )}
        <FieldError>{error}</FieldError>
        <Button
          type="submit"
          size="lg"
          variant={warnings.length > 0 ? "destructive" : "default"}
          disabled={isPending}
          className={submitClass}
        >
          {isPending ? "Saving…" : warnings.length > 0 ? "Log anyway" : "Log it"}
        </Button>
      </FieldGroup>
    </form>
  );
}

const MAX_ROWS = 3;

const ORDERS = {
  latest: "Latest added",
  frequent: "Most frequent",
  first: "First added",
} as const;
type Order = keyof typeof ORDERS;

/** Presets in the order picked on the dashboard. "Most frequent" counts entries logged from each one. */
function orderPresets(presets: PresetRow[], order: Order, transactions: Overview["transactions"]) {
  const byAge = [...presets].sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (order === "first") return byAge;
  if (order === "latest") return byAge.reverse();
  // Logging a preset saves its name as the entry's note (logPreset); ties go to the newest
  const uses = new Map<string, number>();
  for (const t of transactions) {
    if (t.source === "preset" && t.note) uses.set(t.note, (uses.get(t.note) ?? 0) + 1);
  }
  return byAge.reverse().sort((a, b) => (uses.get(b.name) ?? 0) - (uses.get(a.name) ?? 0));
}

/** The new-preset sheet behind the + button; trackers load only when it opens. */
function NewPreset({ overview, onDone }: { overview: Overview; onDone: () => void }) {
  const trackers = useTrackers();
  if (!trackers) return <Skeleton className="h-64 w-full" />;
  return (
    <PresetForm
      categories={overview.categories}
      accounts={overview.accounts}
      trackers={trackers.trackers.filter((t) => !t.archived && t.kind === "goal")}
      onSaved={onDone}
    />
  );
}

/** Dashboard preset chips: tap one, confirm, done (roadmap Phase 8). Wraps onto up to three rows. */
export function QuickAdd({ overview }: { overview: Overview }) {
  const [open, setOpen] = useState<PresetRow | null>(null);
  const [adding, setAdding] = useState(false);
  // Remembered on this device
  const order = useLiveQuery(async () => (await getMeta<Order>("presetOrder")) ?? "frequent", [], "frequent");
  const presets = orderPresets(
    overview.presets.filter((p) => !p.archived_at),
    order,
    overview.transactions,
  );
  const categoryById = new Map(overview.categories.map((c) => [c.id, c]));

  // How many chips fit in MAX_ROWS rows with the + after them, measured before paint
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // A count measured for other chips or another width doesn't apply: start over with all of them
  const measureKey = `${width}|${presets.map((p) => `${p.id}:${p.name}:${p.amount}`).join()}`;
  const [shown, setShown] = useState({ key: "", count: Infinity });
  const visible = presets.slice(0, shown.key === measureKey ? shown.count : Infinity);
  const hidden = presets.length - visible.length;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  // Drop chips from the end until the + sits within MAX_ROWS rows
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = [...list.children] as HTMLElement[];
    // Everything is centred in its row, so each row has one centre line
    const centre = (el: HTMLElement) => Math.round(el.offsetTop + el.offsetHeight / 2);
    const rows = [...new Set(items.map(centre))].sort((a, b) => a - b);
    if (rows.length <= MAX_ROWS) return;
    const fit = items.filter((el) => centre(el) <= rows[MAX_ROWS - 1]).length;
    setShown({ key: measureKey, count: Math.max(0, Math.min(visible.length - 1, fit - 1)) });
  }, [measureKey, visible.length]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Zap className="size-3.5 text-primary" /> Quick add
          </span>
          {presets.length > 0 && (
            <span className="flex items-center gap-3">
              <NativeSelect
                size="sm"
                value={order}
                onChange={(e) => void setMeta("presetOrder", e.target.value)}
                aria-label="Order presets by"
              >
                {Object.entries(ORDERS).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Link href="/settings/presets" className="text-sm font-medium whitespace-nowrap text-primary underline underline-offset-4">
                {hidden > 0 ? `All ${presets.length}` : "Edit"}
              </Link>
            </span>
          )}
        </div>

        <div ref={listRef} className="relative flex flex-wrap items-center gap-2">
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen(p)}
              className="flex h-8 max-w-full items-center gap-2 rounded-full border bg-card pr-3 pl-1 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent active:scale-95"
            >
              <CategoryIcon
                category={categoryById.get(p.category_id ?? "") ?? { name: p.type === "contribution" ? "savings" : p.name }}
                size="xs"
                className="shrink-0 rounded-full"
              />
              <span className="min-w-0 truncate">{p.name}</span>
              <span
                className={cn(
                  "tabular-nums",
                  p.type === "expense" ? "text-expense" : p.type === "income" ? "text-income" : "text-muted-foreground",
                )}
              >
                {formatPeso(p.amount, { whole: true })}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="New preset"
            title="New preset"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95"
          >
            <Plus className="size-4" />
          </button>
          {presets.length === 0 && <span className="text-sm text-muted-foreground">Add presets for things you log often</span>}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{open?.name}</DialogTitle>
            <DialogDescription>Logged for today. Change the amount if it&apos;s different this time.</DialogDescription>
          </DialogHeader>
          {open && <LogPreset key={open.id} preset={open} overview={overview} onDone={() => setOpen(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New preset</DialogTitle>
          </DialogHeader>
          {adding && <NewPreset overview={overview} onDone={() => setAdding(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
