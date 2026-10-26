"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, LayoutList, Plus, Target, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/finance/category-icon";
import { inputClass, labelClass, selectClass, submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ACCOUNT_KIND_LABELS, type AccountKind } from "@/lib/finance/types";
import { formatPeso, parseOptionalPeso } from "@/lib/money";
import { completeSetup } from "@/lib/local/mutations";
import { cn } from "@/lib/utils";

type AccountRow = { key: string; name: string; kind: AccountKind; balance: string };
type BudgetMode = "total" | "categories";

const MODES: { value: BudgetMode; title: string; text: string; icon: typeof Target }[] = [
  { value: "total", title: "One total", text: "A single limit for everything you spend", icon: Target },
  { value: "categories", title: "By category", text: "A limit for food, fare, bills and so on", icon: LayoutList },
];

const newRow = (name = "", kind: AccountKind = "cash"): AccountRow => ({ key: crypto.randomUUID(), name, kind, balance: "" });

/** First-login wizard: accounts with starting balances, then the monthly budget template (roadmap Phase 3). */
export function SetupWizard({ expenseCategories }: { expenseCategories: { id: string; name: string }[] }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [accounts, setAccounts] = useState<AccountRow[]>(() => [newRow("Wallet", "cash")]);
  const [mode, setMode] = useState<BudgetMode>("total");
  const [total, setTotal] = useState("");
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const updateAccount = (key: string, patch: Partial<AccountRow>) =>
    setAccounts((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function goToBudget() {
    if (accounts.some((a) => !a.name.trim())) return setError("Give every account a name.");
    if (accounts.some((a) => parseOptionalPeso(a.balance) === null)) {
      return setError("Check the starting balances. Use numbers like 1500 or 1,500.50.");
    }
    setError(undefined);
    setStep(2);
  }

  function finish() {
    setError(undefined);
    startTransition(async () => {
      const result = await completeSetup({
        accounts: accounts.map(({ name, kind, balance }) => ({ name, kind, balance })),
        limits: mode === "categories" ? Object.entries(limits).map(([categoryId, amount]) => ({ categoryId, amount })) : [],
        totalLimit: mode === "total" ? total : "",
      });
      // On success the dashboard sees the new accounts and closes the dialog itself
      if (result.error) setError(result.error);
    });
  }

  const totalLimit = Object.values(limits).reduce((sum, v) => sum + (parseOptionalPeso(v) ?? 0), 0);

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className={labelClass}>Step {step} of 2</p>
        <DialogTitle className="font-display text-2xl uppercase tracking-widest">
          {step === 1 ? "Your accounts" : "Monthly budget"}
        </DialogTitle>
        <DialogDescription className="text-base">
          {step === 1
            ? "Where your money sits: cash, bank and e-wallets. Enter what's in each right now."
            : "How do you want to budget? Every new month starts from this, and you can change it any time."}
        </DialogDescription>
      </div>

      {step === 1 ? (
        <div className="flex flex-col gap-3">
          {accounts.map((account, i) => (
            <Card key={account.key}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Input
                    aria-label={`Account ${i + 1} name`}
                    placeholder="e.g. BPI, GCash, Wallet"
                    value={account.name}
                    onChange={(e) => updateAccount(account.key, { name: e.target.value })}
                    className={inputClass}
                  />
                  <NativeSelect
                    aria-label={`Account ${i + 1} type`}
                    value={account.kind}
                    onChange={(e) => updateAccount(account.key, { kind: e.target.value as AccountKind })}
                    className="w-28 shrink-0 sm:w-36"
                    selectClassName={selectClass}
                  >
                    {Object.entries(ACCOUNT_KIND_LABELS).map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
                    <Input
                      aria-label={`Account ${i + 1} starting balance`}
                      inputMode="decimal"
                      placeholder="Starting balance"
                      value={account.balance}
                      onChange={(e) => updateAccount(account.key, { balance: e.target.value })}
                      className={`${inputClass} pl-7`}
                    />
                  </div>
                  {accounts.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      aria-label={`Remove ${account.name || `account ${i + 1}`}`}
                      onClick={() => setAccounts((rows) => rows.filter((r) => r.key !== account.key))}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            size="lg"
            className="h-11 border-dashed"
            onClick={() => setAccounts((rows) => [...rows, newRow("", rows.length === 1 ? "bank" : "ewallet")])}
          >
            <Plus /> Add another account
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Budget type" className="grid grid-cols-2 gap-2">
            {MODES.map(({ value, title, text, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className="flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors hover:bg-accent aria-checked:border-primary aria-checked:bg-primary/10"
              >
                <Icon className={cn("size-5", mode === value ? "text-primary" : "text-muted-foreground")} />
                <span className="font-semibold">{title}</span>
                <span className="text-xs text-muted-foreground">{text}</span>
              </button>
            ))}
          </div>

          {mode === "total" ? (
            <Card>
              <CardContent className="flex flex-col gap-2">
                <label htmlFor="setup-total" className={labelClass}>
                  Monthly budget
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
                  <Input
                    id="setup-total"
                    inputMode="decimal"
                    placeholder="e.g. 20000"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    autoFocus
                    className={`${inputClass} pl-7 text-lg font-semibold`}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Leave blank to skip for now. You can add category limits later under Budget.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col divide-y">
                {expenseCategories.map((category) => (
                  <label key={category.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <CategoryIcon category={{ name: category.name, kind: "expense" }} size="sm" />
                      <span className="truncate font-medium">{category.name}</span>
                    </span>
                    <span className="relative w-36 shrink-0">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
                      <Input
                        inputMode="decimal"
                        placeholder="No limit"
                        value={limits[category.id] ?? ""}
                        onChange={(e) => setLimits((l) => ({ ...l, [category.id]: e.target.value }))}
                        className={`${inputClass} pl-7 text-right`}
                      />
                    </span>
                  </label>
                ))}
                <div className="flex items-center justify-between pt-3 font-semibold">
                  <span>Total per month</span>
                  <span className="tabular-nums">{formatPeso(totalLimit)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <FieldError>{error}</FieldError>

      <div className="flex gap-2">
        {step === 2 && (
          <Button variant="outline" size="lg" className={submitClass} onClick={() => setStep(1)} disabled={isPending}>
            <ArrowLeft /> Back
          </Button>
        )}
        <Button size="lg" className={`${submitClass} flex-1`} onClick={step === 1 ? goToBudget : finish} disabled={isPending}>
          {step === 1 ? "Next: budget" : isPending ? "Setting up…" : "Finish setup"}
        </Button>
      </div>
    </>
  );
}
