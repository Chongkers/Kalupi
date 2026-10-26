"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TriangleAlert, Zap } from "lucide-react";
import { amountInputClass, labelClass, selectClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { guardrailWarnings } from "@/lib/finance/guardrail";
import type { PresetRow } from "@/lib/local/db";
import type { Overview } from "@/lib/local/hooks";
import { logPreset } from "@/lib/local/mutations";
import { formatPeso, parsePeso, toInputValue } from "@/lib/money";
import { cn } from "@/lib/utils";

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

/** Dashboard row of preset chips: tap one, confirm, done (roadmap Phase 8). */
export function QuickAdd({ overview }: { overview: Overview }) {
  const [open, setOpen] = useState<PresetRow | null>(null);
  const presets = overview.presets.filter((p) => !p.archived_at);

  return (
    <>
      {/* One swipeable row on phones, wrapping on wider screens */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Zap className="size-3.5 text-primary" /> Quick add
        </span>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p)}
            className="flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent active:scale-95"
          >
            {p.name}
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
        <Link href="/settings/presets" className="shrink-0 text-sm font-medium whitespace-nowrap text-primary underline underline-offset-4">
          {presets.length > 0 ? "Edit" : "Add presets for things you log often"}
        </Link>
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
    </>
  );
}
