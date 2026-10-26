"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowLeft, HandCoins, MessageCircle, Pencil, Plus, Receipt, Trash2, UserPlus } from "lucide-react";
import { amountInputClass, inputClass, labelClass, selectClass, submitClass } from "@/components/form-styles";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/trackers/confirm-button";
import { MemberAvatar } from "@/components/trackers/progress-ring";
import { TrackerForm } from "@/components/trackers/tracker-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatDay, type DateString } from "@/lib/dates";
import { reminderText, splitEvenly, type SplitEntry } from "@/lib/finance/splits";
import { OPENING_BALANCE } from "@/lib/finance/types";
import { useOverview, type Overview, type SplitTrackerView } from "@/lib/local/hooks";
import {
  addSplitPerson,
  deleteSplitEntry,
  ME,
  removeSplitPerson,
  renameSplitPerson,
  saveSplitBill,
  setTrackerArchived,
  settleUp,
} from "@/lib/local/mutations";
import { formatPeso, parsePeso, toInputValue } from "@/lib/money";
import { cn } from "@/lib/utils";

type Person = SplitTrackerView["people"][number];

/** "owes you ₱250" / "you owe ₱100" / "settled" */
function BalanceLabel({ balance, className }: { balance: number; className?: string }) {
  if (balance === 0) return <span className={cn("text-sm text-muted-foreground", className)}>settled</span>;
  return (
    <span className={cn("text-sm font-semibold tabular-nums", balance > 0 ? "text-income" : "text-expense", className)}>
      {balance > 0 ? `owes you ${formatPeso(balance)}` : `you owe ${formatPeso(-balance)}`}
    </span>
  );
}

async function sendReminder(text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(text);
  toast.success("Reminder copied. Paste it in a message.");
}

// ---------------------------------------------------------------------------
// Bill form
// ---------------------------------------------------------------------------

function BillForm({
  tracker,
  overview,
  today,
  onSaved,
}: {
  tracker: SplitTrackerView;
  overview: Overview;
  today: DateString;
  onSaved: () => void;
}) {
  const everyone = [{ id: ME, name: "You" }, ...tracker.people];
  const [paidBy, setPaidBy] = useState(ME);
  const [participants, setParticipants] = useState<string[]>(everyone.map((p) => p.id));
  const [mode, setMode] = useState<"equal" | "exact">("equal");
  const [amount, setAmount] = useState("");
  const [exact, setExact] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const categories = overview.categories.filter((c) => c.kind === "expense" && !c.archived_at && c.name !== OPENING_BALANCE);
  const accounts = overview.accounts.filter((a) => !a.archived);
  // Same order the mutation uses: you first, so you take any leftover centavo
  const chosen = everyone.filter((p) => participants.includes(p.id));
  const total = parsePeso(amount);
  const even = total ? splitEvenly(total, chosen.length) : [];
  const exactSum = chosen.reduce((sum, p) => sum + (parsePeso(exact[p.id] ?? "") ?? 0), 0);

  const toggle = (id: string) =>
    setParticipants((list) => (list.includes(id) ? list.filter((p) => p !== id) : [...list, id]));

  function submit(formData: FormData) {
    const get = (key: string) => String(formData.get(key) ?? "");
    startTransition(async () => {
      const result = await saveSplitBill({
        trackerId: tracker.id,
        note: get("note"),
        amount,
        occurredOn: get("occurredOn"),
        categoryId: get("categoryId"),
        paidBy,
        accountId: get("accountId"),
        participants,
        mode,
        exact,
      });
      setError(result.error);
      if (!result.error) onSaved();
    });
  }

  return (
    <form action={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="bill-amount" className={cn(labelClass, "mx-auto")}>
            Total bill
          </FieldLabel>
          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-bold">₱</span>
            <Input
              id="bill-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
              className={cn(amountInputClass, "max-w-48")}
            />
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="bill-note" className={labelClass}>
            What for
          </FieldLabel>
          <Input id="bill-note" name="note" placeholder="e.g. Dinner at Manam" maxLength={200} required className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bill-paid-by" className={labelClass}>
              Who paid
            </FieldLabel>
            <NativeSelect
              id="bill-paid-by"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full"
              selectClassName={selectClass}
            >
              {everyone.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {paidBy === ME ? (
            <Field>
              <FieldLabel htmlFor="bill-account" className={labelClass}>
                Paid from
              </FieldLabel>
              <NativeSelect id="bill-account" name="accountId" defaultValue={accounts[0]?.id} className="w-full" selectClassName={selectClass}>
                {accounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name} · {formatPeso(a.balance)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="bill-date" className={labelClass}>
                Date
              </FieldLabel>
              <Input id="bill-date" name="occurredOn" type="date" defaultValue={today} required className={inputClass} />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bill-category" className={labelClass}>
              Your share counts as
            </FieldLabel>
            <NativeSelect id="bill-category" name="categoryId" defaultValue={categories[0]?.id} className="w-full" selectClassName={selectClass}>
              {categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {paidBy === ME && (
            <Field>
              <FieldLabel htmlFor="bill-date" className={labelClass}>
                Date
              </FieldLabel>
              <Input id="bill-date" name="occurredOn" type="date" defaultValue={today} required className={inputClass} />
            </Field>
          )}
        </div>

        <Field>
          <div className="flex items-center justify-between gap-2">
            <span className={labelClass}>Split between</span>
            <div role="radiogroup" aria-label="How to split" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5">
              {(["equal", "exact"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm"
                >
                  {value === "equal" ? "Equally" : "Exact amounts"}
                </button>
              ))}
            </div>
          </div>
          <ul className="flex flex-col divide-y rounded-xl border">
            {everyone.map((p) => {
              const index = chosen.findIndex((c) => c.id === p.id);
              const on = index >= 0;
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="size-4 accent-primary" />
                    <span className={cn("truncate", !on && "text-muted-foreground")}>{p.name}</span>
                  </label>
                  {on &&
                    (mode === "equal" ? (
                      <span className="text-sm tabular-nums text-muted-foreground">{total ? formatPeso(even[index]) : "—"}</span>
                    ) : (
                      <span className="relative w-28">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                        <Input
                          aria-label={`${p.name}'s share`}
                          inputMode="decimal"
                          placeholder="0"
                          value={exact[p.id] ?? ""}
                          onChange={(e) => setExact((v) => ({ ...v, [p.id]: e.target.value }))}
                          className="h-9 pl-6 text-right tabular-nums"
                        />
                      </span>
                    ))}
                </li>
              );
            })}
          </ul>
          {mode === "exact" && total !== null && exactSum !== total && (
            <p className="text-sm text-muted-foreground tabular-nums">
              {exactSum < total ? `${formatPeso(total - exactSum)} left to assign` : `${formatPeso(exactSum - total)} too much`}
            </p>
          )}
          {paidBy !== ME && (
            <p className="text-sm text-muted-foreground">
              Only your share is tracked. What others owe {everyone.find((p) => p.id === paidBy)?.name} is between them.
            </p>
          )}
        </Field>

        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" disabled={isPending || categories.length === 0 || (paidBy === ME && accounts.length === 0)} className={submitClass}>
          {isPending ? "Saving…" : "Add bill"}
        </Button>
      </FieldGroup>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Settle up form
// ---------------------------------------------------------------------------

function SettleForm({
  tracker,
  person,
  overview,
  today,
  onSaved,
}: {
  tracker: SplitTrackerView;
  person: Person;
  overview: Overview;
  today: DateString;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const theyPay = person.balance > 0;
  const accounts = overview.accounts.filter((a) => !a.archived);

  function submit(formData: FormData) {
    const get = (key: string) => String(formData.get(key) ?? "");
    startTransition(async () => {
      const result = await settleUp({
        trackerId: tracker.id,
        personId: person.id,
        amount: get("amount"),
        accountId: get("accountId"),
        occurredOn: get("occurredOn"),
      });
      setError(result.error);
      if (!result.error) onSaved();
    });
  }

  return (
    <form action={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="settle-amount" className={cn(labelClass, "mx-auto")}>
            {theyPay ? `${person.name} paid you` : `You paid ${person.name}`}
          </FieldLabel>
          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-bold">₱</span>
            <Input
              id="settle-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={toInputValue(Math.abs(person.balance))}
              autoFocus
              required
              className={cn(amountInputClass, "max-w-48")}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {theyPay ? `${person.name} owes you` : `You owe ${person.name}`} {formatPeso(Math.abs(person.balance))}. Change it for a partial payment.
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="settle-account" className={labelClass}>
              {theyPay ? "Into" : "From"}
            </FieldLabel>
            <NativeSelect id="settle-account" name="accountId" defaultValue={accounts[0]?.id} className="w-full" selectClassName={selectClass}>
              {accounts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name} · {formatPeso(a.balance)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="settle-date" className={labelClass}>
              Date
            </FieldLabel>
            <Input id="settle-date" name="occurredOn" type="date" defaultValue={today} required className={inputClass} />
          </Field>
        </div>

        <p className="text-sm text-muted-foreground">
          This moves money {theyPay ? "into" : "out of"} the account, but doesn&apos;t count as {theyPay ? "income" : "spending"}.
        </p>

        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" disabled={isPending || accounts.length === 0} className={submitClass}>
          {isPending ? "Saving…" : "Record payment"}
        </Button>
      </FieldGroup>
    </form>
  );
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

function AddPersonForm({ trackerId, autoFocus }: { trackerId: string; autoFocus?: boolean }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      action={() =>
        startTransition(async () => {
          const result = await addSplitPerson(trackerId, name);
          setError(result.error);
          if (!result.error) setName("");
        })
      }
    >
      <div className="flex gap-2">
        <Input
          aria-label="Name"
          placeholder="Add a friend's name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoFocus={autoFocus}
          className={inputClass}
        />
        <Button type="submit" size="lg" variant="outline" disabled={isPending || !name.trim()} className="h-11">
          <UserPlus /> Add
        </Button>
      </div>
      <FieldError>{error}</FieldError>
    </form>
  );
}

function RenameForm({ person, onSaved }: { person: Person; onSaved: () => void }) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await renameSplitPerson(person.id, String(formData.get("name") ?? ""));
          setError(result.error);
          if (!result.error) onSaved();
        })
      }
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="person-name" className={labelClass}>
            Name
          </FieldLabel>
          <Input id="person-name" name="name" defaultValue={person.name} maxLength={40} required autoFocus className={inputClass} />
        </Field>
        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </FieldGroup>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

function entryTitle(entry: SplitEntry) {
  return entry.note ?? (entry.kind === "paid-you-back" || entry.kind === "you-paid-back" ? "Payback" : "Bill");
}

function entryDetails(entry: SplitEntry, names: Map<string, string>, accountName: Map<string, string>) {
  const who = (id: string) => names.get(id) ?? "Someone";
  switch (entry.kind) {
    case "you-paid":
      return `You paid ${formatPeso(entry.amount)} from ${accountName.get(entry.accountId ?? "") ?? "an account"} · your share ${formatPeso(entry.yourShare ?? 0)}`;
    case "they-paid":
      return `${who(entry.people[0]?.personId)} paid · your share ${formatPeso(entry.amount)}`;
    case "paid-you-back":
      return `Into ${accountName.get(entry.accountId ?? "") ?? "an account"}`;
    case "you-paid-back":
      return `From ${accountName.get(entry.accountId ?? "") ?? "an account"}`;
  }
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

type Open =
  | { dialog: "bill" }
  | { dialog: "settle"; person: Person }
  | { dialog: "rename"; person: Person }
  | { dialog: "edit" }
  | null;

export function SplitTracker({ tracker, today }: { tracker: SplitTrackerView; today: DateString }) {
  const overview = useOverview();
  const [open, setOpen] = useState<Open>(null);
  const accountName = new Map(overview?.accounts.map((a) => [a.id, a.name]));
  const close = () => setOpen(null);
  const active = !tracker.archived;
  const settled = tracker.owedToYou === 0 && tracker.youOwe === 0;

  return (
    <>
      <PageHeader
        title={tracker.name}
        description={tracker.archived ? "Archived" : `Settle up${tracker.target_date ? ` · ${formatDay(tracker.target_date, today)}` : ""}`}
      >
        <Button asChild variant="ghost">
          <Link href="/trackers">
            <ArrowLeft /> All trackers
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {/* Totals */}
          <Card>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 rounded-xl bg-income/10 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owed to you</span>
                  <span className="text-2xl font-bold tabular-nums text-income">{formatPeso(tracker.owedToYou)}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl bg-expense/10 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">You owe</span>
                  <span className="text-2xl font-bold tabular-nums text-expense">{formatPeso(tracker.youOwe)}</span>
                </div>
              </div>
              {settled && tracker.entries.length > 0 && <p className="text-center font-semibold text-income">Everyone&apos;s square 🎉</p>}
              {active && (
                <Button size="lg" disabled={tracker.people.length === 0} onClick={() => setOpen({ dialog: "bill" })}>
                  <Plus /> Add a bill
                </Button>
              )}
              {active && tracker.people.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">Add the people you were with first.</p>
              )}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Bills and paybacks</CardTitle>
              <CardDescription>Only you see these.</CardDescription>
            </CardHeader>
            <CardContent>
              {tracker.entries.length === 0 ? (
                <p className="text-muted-foreground">Nothing added yet.</p>
              ) : (
                <ul className="divide-y">
                  {tracker.entries.map((e) => {
                    const isPayback = e.kind === "paid-you-back" || e.kind === "you-paid-back";
                    const Icon = isPayback ? HandCoins : Receipt;
                    return (
                      <li key={e.id} className="flex items-start gap-3 py-3">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                          <Icon className="size-4" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate font-medium">{entryTitle(e)}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatDay(e.occurred_on, today)} · {entryDetails(e, tracker.names, accountName)}
                          </span>
                          {e.kind === "you-paid" && (
                            <span className="text-sm text-muted-foreground">
                              {e.people.map((p) => `${tracker.names.get(p.personId) ?? "Someone"} ${formatPeso(p.amount)}`).join(" · ")}
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 font-semibold tabular-nums",
                            (e.kind === "they-paid" || e.kind === "you-paid-back") && "text-expense",
                            e.kind === "paid-you-back" && "text-income",
                          )}
                        >
                          {formatPeso(e.amount)}
                        </span>
                        {active && (
                          <ConfirmButton
                            size="icon"
                            label="Delete"
                            icon={<Trash2 />}
                            title={isPayback ? "Delete this payback?" : "Delete this bill?"}
                            description="Balances, your budget and your account balance will update."
                            confirm="Delete"
                            destructive
                            action={() => deleteSplitEntry(e.id)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* People */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">People</CardTitle>
              <CardDescription>Just names. They don&apos;t need the app.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {tracker.people.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {tracker.people.map((p) => (
                    <li key={p.id} className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={p.name} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium">{p.name}</span>
                          <BalanceLabel balance={p.balance} />
                        </div>
                        {active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Rename ${p.name}`}
                            onClick={() => setOpen({ dialog: "rename", person: p })}
                          >
                            <Pencil />
                          </Button>
                        )}
                        {active && p.balance === 0 && (
                          <ConfirmButton
                            size="icon"
                            label={`Remove ${p.name}`}
                            icon={<Trash2 />}
                            title={`Remove ${p.name}?`}
                            description="Past bills keep their name."
                            confirm="Remove"
                            destructive
                            action={() => removeSplitPerson(p.id)}
                          />
                        )}
                      </div>
                      {active && p.balance !== 0 && (
                        <div className="grid grid-cols-2 gap-2 pl-11">
                          <Button size="sm" onClick={() => setOpen({ dialog: "settle", person: p })}>
                            <HandCoins /> Settle up
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void sendReminder(reminderText(p.name, p.balance, tracker.name))}>
                            <MessageCircle /> Remind
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {active && <AddPersonForm trackerId={tracker.id} autoFocus={tracker.people.length === 0} />}
            </CardContent>
          </Card>

          {/* Manage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Manage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {active && (
                <Button variant="outline" onClick={() => setOpen({ dialog: "edit" })}>
                  <Pencil /> Edit name or date
                </Button>
              )}
              {tracker.myRole === "owner" && (
                <ConfirmButton
                  label={tracker.archived ? "Restore tracker" : "Archive tracker"}
                  icon={tracker.archived ? <ArchiveRestore /> : <Archive />}
                  title={tracker.archived ? "Restore this tracker?" : "Archive this tracker?"}
                  description={
                    tracker.archived
                      ? "It moves back to your active trackers."
                      : settled
                        ? "It's hidden from your active trackers. You can restore it any time."
                        : "Someone still owes money here. It'll be hidden, but the balances stay until you restore it and settle up."
                  }
                  confirm={tracker.archived ? "Restore" : "Archive"}
                  action={() => setTrackerArchived(tracker.id, !tracker.archived)}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(isOpen) => !isOpen && close()}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          {open?.dialog === "bill" && overview && (
            <>
              <DialogHeader>
                <DialogTitle>Add a bill</DialogTitle>
                <DialogDescription>Your budget counts only your share.</DialogDescription>
              </DialogHeader>
              <BillForm
                tracker={tracker}
                overview={overview}
                today={today}
                onSaved={() => {
                  close();
                  toast.success("Bill added");
                }}
              />
            </>
          )}
          {open?.dialog === "settle" && overview && (
            <>
              <DialogHeader>
                <DialogTitle>Settle up with {open.person.name}</DialogTitle>
              </DialogHeader>
              <SettleForm
                tracker={tracker}
                person={open.person}
                overview={overview}
                today={today}
                onSaved={() => {
                  close();
                  toast.success("Payment recorded");
                }}
              />
            </>
          )}
          {open?.dialog === "rename" && (
            <>
              <DialogHeader>
                <DialogTitle>Rename {open.person.name}</DialogTitle>
              </DialogHeader>
              <RenameForm person={open.person} onSaved={close} />
            </>
          )}
          {open?.dialog === "edit" && (
            <>
              <DialogHeader>
                <DialogTitle>Edit tracker</DialogTitle>
              </DialogHeader>
              <TrackerForm kind="split" initial={tracker} onSaved={close} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
