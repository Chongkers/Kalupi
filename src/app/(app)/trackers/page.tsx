"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Goal, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MemberAvatar, Milestones, ProgressRing } from "@/components/trackers/progress-ring";
import { TrackerForm } from "@/components/trackers/tracker-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/dates";
import { daysUntil, monthlyNeeded } from "@/lib/finance/trackers";
import { useTrackers, type TrackerView } from "@/lib/local/hooks";
import { formatPeso } from "@/lib/money";

function TrackerCard({ tracker, today }: { tracker: TrackerView; today: string }) {
  const percent = (tracker.total / tracker.target_amount) * 100;
  const remaining = tracker.target_amount - tracker.total;
  const perMonth = monthlyNeeded(remaining, tracker.target_date, today);
  const days = tracker.target_date ? daysUntil(tracker.target_date, today) : null;

  return (
    <Link href={`/trackers/view?id=${tracker.id}`} className="group">
      <Card className="h-full transition-colors group-hover:bg-accent/40">
        <CardContent className="flex h-full flex-col gap-4">
          <div className="flex items-start gap-4">
            <ProgressRing percent={percent} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-lg font-semibold">{tracker.name}</span>
              <span className="text-sm tabular-nums">
                <span className="font-semibold">{formatPeso(tracker.total, { whole: true })}</span>
                <span className="text-muted-foreground"> of {formatPeso(tracker.target_amount, { whole: true })}</span>
              </span>
              {remaining > 0 ? (
                <span className="text-sm text-muted-foreground">{formatPeso(remaining, { whole: true })} to go</span>
              ) : (
                <span className="text-sm font-medium text-income">Goal reached 🎉</span>
              )}
            </div>
          </div>

          <Milestones percent={percent} />

          <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3 text-sm">
            <span className="flex -space-x-2">
              {tracker.members.slice(0, 4).map((m) => (
                <MemberAvatar key={m.userId} name={m.name} className="size-7 text-[10px]" />
              ))}
              {tracker.members.length <= 1 && (
                <span className="flex items-center gap-1 pl-3 text-muted-foreground">
                  <Users className="size-3.5" /> Just you
                </span>
              )}
            </span>
            {days !== null && remaining > 0 && (
              <span className={days < 0 ? "text-expense" : "text-muted-foreground"}>
                <CalendarClock className="mr-1 inline size-3.5" />
                {days < 0
                  ? `Due ${formatDay(tracker.target_date!, today)}`
                  : perMonth
                    ? `${formatPeso(perMonth, { whole: true })}/mo · ${days}d left`
                    : `${days}d left`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function TrackersPage() {
  const data = useTrackers();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = data?.trackers.filter((t) => !t.archived) ?? [];
  const archived = data?.trackers.filter((t) => t.archived) ?? [];
  const saved = active.reduce((sum, t) => sum + t.total, 0);

  return (
    <>
      <PageHeader
        title="Trackers"
        description={active.length > 0 ? `${formatPeso(saved, { whole: true })} saved across ${active.length} ${active.length === 1 ? "goal" : "goals"}` : "Savings you share with a friend"}
      >
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus /> New tracker
        </Button>
      </PageHeader>

      {!data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Goal className="size-7" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold">No trackers yet</span>
              <span className="max-w-sm text-sm text-muted-foreground">
                Pick something to save for, like a trip or a new phone, then invite a friend to save with you.
              </span>
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus /> Create your first tracker
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((t) => (
            <TrackerCard key={t.id} tracker={t} today={data.today} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="flex flex-col gap-3">
          <Button variant="ghost" className="self-start" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </Button>
          {showArchived && (
            <div className="grid gap-4 opacity-70 md:grid-cols-2 xl:grid-cols-3">
              {archived.map((t) => (
                <TrackerCard key={t.id} tracker={t} today={data!.today} />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New tracker</DialogTitle>
            <DialogDescription>What are you saving for?</DialogDescription>
          </DialogHeader>
          <TrackerForm onSaved={(id) => router.push(`/trackers/view?id=${id}`)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
