"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PresetForm } from "@/components/finance/preset-form";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { PRESET_ORDERS } from "@/lib/finance/presets";
import { setMeta, type PresetRow } from "@/lib/local/db";
import { useOverview, useTrackers } from "@/lib/local/hooks";
import { setPresetArchived } from "@/lib/local/mutations";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

const TYPE_LABEL = { expense: "Expense", income: "Income", contribution: "Tracker" } as Record<string, string>;

function ArchiveButton({ preset }: { preset: PresetRow }) {
  const [isPending, startTransition] = useTransition();
  const archived = !!preset.archived_at;
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      aria-label={archived ? `Restore ${preset.name}` : `Archive ${preset.name}`}
      onClick={() => startTransition(async () => void (await setPresetArchived(preset.id, !archived)))}
    >
      {archived ? <ArchiveRestore /> : <Archive />}
    </Button>
  );
}

export default function PresetsPage() {
  const overview = useOverview();
  const trackers = useTrackers();
  const [editing, setEditing] = useState<PresetRow | "new" | null>(null);

  if (!overview || !trackers) {
    return (
      <>
        <PageHeader title="Presets" description="Things you log often, one tap away" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

  const names = new Map([
    ...overview.categories.map((c) => [c.id, c.name] as const),
    ...trackers.trackers.map((t) => [t.id, t.name] as const),
    ...overview.accounts.map((a) => [a.id, a.name] as const),
  ]);
  const activeTrackers = trackers.trackers.filter((t) => !t.archived && t.kind === "goal");
  // overview.presets is already in the picked order; archived ones go last
  const sorted = [...overview.presets].sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at));

  return (
    <>
      <PageHeader title="Presets" description="Things you log often, one tap away">
        <Button size="lg" onClick={() => setEditing("new")}>
          <Plus /> New preset
        </Button>
      </PageHeader>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Your presets</CardTitle>
          <CardDescription>They show up under Quick add on the dashboard, in this order.</CardDescription>
          {overview.presets.length > 1 && (
            <CardAction>
              {/* Remembered on this device; the dashboard and Add entry follow it */}
              <NativeSelect
                size="sm"
                value={overview.presetOrder}
                onChange={(e) => void setMeta("presetOrder", e.target.value)}
                aria-label="Order presets by"
              >
                {Object.entries(PRESET_ORDERS).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Zap className="size-8 text-primary" />
              <p className="max-w-xs text-sm text-muted-foreground">
                Make one for your daily fare, coffee, or allowance, then log it from the dashboard in one tap.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {sorted.map((p) => (
                <li key={p.id} className={cn("flex items-center gap-3 py-3", p.archived_at && "opacity-60")}>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {p.name}
                      {p.archived_at && <span className="ml-2 text-xs font-semibold uppercase text-muted-foreground">Archived</span>}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[
                        TYPE_LABEL[p.type],
                        names.get(p.category_id ?? p.tracker_id ?? ""),
                        p.account_id ? names.get(p.account_id) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums">{formatPeso(p.amount)}</span>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                    <Pencil />
                  </Button>
                  <ArchiveButton preset={p} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New preset" : "Edit preset"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <PresetForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? undefined : editing}
              categories={overview.categories}
              accounts={overview.accounts}
              trackers={activeTrackers}
              onSaved={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
