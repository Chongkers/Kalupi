"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AccountIcon, CategoryIcon } from "@/components/finance/category-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDay } from "@/lib/dates";
import { planTarsiImport, readTarsiBackup, TarsiFormatError, type ImportPlan } from "@/lib/import/tarsi";
import { ACCOUNT_KIND_LABELS } from "@/lib/finance/types";
import { importTarsi, replaceImpact } from "@/lib/local/mutations";
import { formatPeso } from "@/lib/money";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Preview({ plan, fileName, onDone }: { plan: ImportPlan; fileName: string; onDone: () => void }) {
  const [impact, setImpact] = useState<Awaited<ReturnType<typeof replaceImpact>>>();
  const [isPending, startTransition] = useTransition();
  const incomeCount = plan.entries.filter((e) => e.type === "income").length;
  const expenseCount = plan.entries.length - incomeCount;

  useEffect(() => {
    void replaceImpact().then(setImpact);
  }, []);

  const removing = impact
    ? [plural(impact.accounts, "account"), plural(impact.entries, "entry", "entries")]
        .concat(impact.splitShares ? [plural(impact.splitShares, "settle-up share")] : [])
        .join(", ")
    : "…";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Accounts</CardTitle>
            <CardDescription>Balances will match Tarsi.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {plan.accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <AccountIcon kind={a.kind} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {a.name}
                      {a.archived && <span className="ml-2 text-xs font-semibold uppercase text-muted-foreground">Archived</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ACCOUNT_KIND_LABELS[a.kind]}
                      {a.opening > 0 && ` · starts with ${formatPeso(a.opening)} on ${formatDay(a.openingDate)}`}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatPeso(a.balance)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Categories</CardTitle>
            <CardDescription>Matched to yours by name; any you don&apos;t have are added.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {plan.categories.map((c) => (
              <span key={`${c.kind}:${c.name}`} className="flex items-center gap-2 rounded-lg border py-1 pr-3 pl-1 text-sm">
                <CategoryIcon category={c} size="xs" />
                {c.name}
                <span className="text-xs text-muted-foreground">{c.kind}</span>
              </span>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{fileName}</CardTitle>
          <CardDescription>
            {plan.totals.first && plan.totals.last
              ? `${formatDay(plan.totals.first)} to ${formatDay(plan.totals.last)}`
              : "No entries"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col">
              <dt className="text-muted-foreground">{plural(incomeCount, "income entry", "income entries")}</dt>
              <dd className="font-semibold text-income tabular-nums">+{formatPeso(plan.totals.income)}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-muted-foreground">{plural(expenseCount, "expense")}</dt>
              <dd className="font-semibold text-expense tabular-nums">−{formatPeso(plan.totals.expense)}</dd>
            </div>
          </dl>

          {(plan.warnings.length > 0 || Object.keys(plan.skipped).length > 0) && (
            <ul className="flex flex-col gap-1.5 rounded-xl bg-expense/10 p-3 text-sm text-expense">
              {plan.warnings.map((w) => (
                <li key={w} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
                </li>
              ))}
              {Object.entries(plan.skipped).map(([type, count]) => (
                <li key={type} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> Not imported: {count} {type}
                </li>
              ))}
            </ul>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="lg" variant="destructive" disabled={isPending || !impact}>
                {isPending ? "Importing…" : "Replace my data with this"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Replace your data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes your {removing} on every device, then adds {plural(plan.accounts.length, "account")} and{" "}
                  {plural(plan.entries.length, "entry", "entries")} from Tarsi. Your categories, budgets, presets
                  and trackers stay. It can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await importTarsi(plan);
                      if (result.error) return void toast.error(result.error);
                      toast.success(`Imported ${plural(result.added ?? 0, "entry", "entries")} from Tarsi`);
                      onDone();
                    })
                  }
                >
                  Replace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-xs text-muted-foreground">Saved on this device first, then synced to your other devices.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ImportPage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<{ plan: ImportPlan; fileName: string } | null>(null);
  const [error, setError] = useState<string>();

  async function read(file: File) {
    setError(undefined);
    try {
      const plan = planTarsiImport(readTarsiBackup(await file.text()));
      if (plan.accounts.length === 0) throw new TarsiFormatError("This backup has no accounts in it.");
      setLoaded({ plan, fileName: file.name });
    } catch (e) {
      setLoaded(null);
      setError(e instanceof TarsiFormatError ? e.message : "Couldn't read that file.");
    }
  }

  return (
    <>
      <PageHeader title="Import" description="Bring your history over from Tarsi">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void read(file);
          }}
        />
        <Button size="lg" variant={loaded ? "outline" : "default"} onClick={() => input.current?.click()}>
          <FileUp /> {loaded ? "Pick another file" : "Pick Tarsi backup"}
        </Button>
      </PageHeader>

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-expense/10 p-3 text-sm text-expense">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {loaded ? (
        <Preview key={loaded.fileName} plan={loaded.plan} fileName={loaded.fileName} onDone={() => router.push("/")} />
      ) : (
        <Card className="max-w-xl">
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              In Tarsi, export a backup as a <span className="font-medium text-foreground">.csv</span> file, then pick it here.
              You&apos;ll see what&apos;s in it before anything changes.
            </p>
            <p>Accounts, income and expenses come over. The file is read on this device and isn&apos;t uploaded.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
