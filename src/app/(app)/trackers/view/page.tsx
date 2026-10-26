"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowLeft, LogOut, Minus, Pencil, Plus, Share2, Trash2, UserMinus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EntryForm } from "@/components/trackers/entry-form";
import { MemberAvatar, Milestones, ProgressRing } from "@/components/trackers/progress-ring";
import { TrackerForm } from "@/components/trackers/tracker-form";
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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/dates";
import { daysUntil, monthlyNeeded } from "@/lib/finance/trackers";
import type { Transaction } from "@/lib/finance/types";
import { useOverview, useTrackers, type TrackerView } from "@/lib/local/hooks";
import { deleteTransaction, leaveTracker, removeMember, setTrackerArchived } from "@/lib/local/mutations";
import { createInviteLink, shareLink } from "@/lib/trackers/invites";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

const linkClass = "text-sm font-medium text-primary underline underline-offset-4";

function ShareButton({ tracker }: { tracker: TrackerView }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const { url, error } = await createInviteLink(tracker.id);
          if (error || !url) return void toast.error(error);
          const how = await shareLink(url, tracker.name);
          if (how === "copied") toast.success("Invite link copied. Paste it in a message to your friend.");
        })
      }
    >
      <Share2 /> {isPending ? "Making link…" : "Invite"}
    </Button>
  );
}

/** Confirm, then run an action that returns { error }. */
function ConfirmButton({
  label,
  icon,
  title,
  description,
  confirm,
  destructive,
  action,
  onDone,
  size,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  confirm: string;
  destructive?: boolean;
  action: () => Promise<{ error?: string }>;
  onDone?: () => void;
  size?: "icon";
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant={size ? "ghost" : "outline"}
            size={size}
            aria-label={size ? label : undefined}
            disabled={isPending}
            className={cn(destructive && !size && "border-destructive/40 text-destructive", destructive && size && "text-destructive")}
          >
            {icon}
            {!size && label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={destructive ? "destructive" : "default"}
              onClick={() =>
                startTransition(async () => {
                  const result = await action();
                  setError(result.error);
                  if (result.error) toast.error(result.error);
                  else onDone?.();
                })
              }
            >
              {confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && !size && <FieldError>{error}</FieldError>}
    </>
  );
}

type EntryDialog = { type: "contribution" | "withdrawal"; initial?: Transaction } | null;

function Tracker({ tracker, today }: { tracker: TrackerView; today: string }) {
  const overview = useOverview();
  const router = useRouter();
  const [entry, setEntry] = useState<EntryDialog>(null);
  const [editing, setEditing] = useState(false);

  const percent = (tracker.total / tracker.target_amount) * 100;
  const remaining = tracker.target_amount - tracker.total;
  const perMonth = monthlyNeeded(remaining, tracker.target_date, today);
  const days = tracker.target_date ? daysUntil(tracker.target_date, today) : null;
  const me = tracker.members.find((m) => m.isMe);
  const isOwner = tracker.myRole === "owner";
  const biggest = Math.max(...tracker.members.map((m) => m.net), 1);
  const accountName = new Map(overview?.accounts.map((a) => [a.id, a.name]));

  return (
    <>
      <PageHeader title={tracker.name} description={tracker.archived ? "Archived" : isOwner ? "You own this tracker" : "Shared with you"}>
        <Button asChild variant="ghost">
          <Link href="/trackers">
            <ArrowLeft /> All trackers
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {/* Progress hero */}
          <Card>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <ProgressRing percent={percent} size="size-36" />
                <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
                  <span className="text-3xl font-bold tabular-nums">{formatPeso(tracker.total)}</span>
                  <span className="text-muted-foreground tabular-nums">of {formatPeso(tracker.target_amount)} target</span>
                  {remaining > 0 ? (
                    <span className="text-sm">
                      <span className="font-semibold tabular-nums">{formatPeso(remaining, { whole: true })}</span> to go
                      {days !== null &&
                        (days < 0
                          ? ` · was due ${formatDay(tracker.target_date!, today)}`
                          : ` · ${days} ${days === 1 ? "day" : "days"} left`)}
                    </span>
                  ) : (
                    <span className="font-semibold text-income">Goal reached! 🎉</span>
                  )}
                  {perMonth && days !== null && days > 0 && (
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium">
                      Save {formatPeso(perMonth, { whole: true })} a month to make it
                    </span>
                  )}
                </div>
              </div>
              <Milestones percent={percent} />
              {!tracker.archived && (
                <div className="grid grid-cols-2 gap-2">
                  <Button size="lg" onClick={() => setEntry({ type: "contribution" })}>
                    <Plus /> Add money
                  </Button>
                  <Button size="lg" variant="outline" disabled={(me?.net ?? 0) <= 0} onClick={() => setEntry({ type: "withdrawal" })}>
                    <Minus /> Withdraw
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Your entries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Your entries</CardTitle>
              <CardDescription>Only you see these. Others see your total.</CardDescription>
            </CardHeader>
            <CardContent>
              {tracker.myEntries.length === 0 ? (
                <p className="text-muted-foreground">Nothing added yet.</p>
              ) : (
                <ul className="divide-y">
                  {tracker.myEntries.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 flex-col text-left"
                        onClick={() => !tracker.archived && setEntry({ type: e.type as "contribution" | "withdrawal", initial: e })}
                      >
                        <span className="truncate font-medium">{e.note || (e.type === "contribution" ? "Added" : "Withdrew")}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {formatDay(e.occurred_on, today)} · {accountName.get(e.account_id)}
                        </span>
                      </button>
                      <span className={cn("font-semibold tabular-nums", e.type === "withdrawal" && "text-expense")}>
                        {e.type === "contribution" ? "+" : "−"}
                        {formatPeso(e.amount)}
                      </span>
                      {!tracker.archived && (
                        <ConfirmButton
                          size="icon"
                          label="Delete entry"
                          icon={<Trash2 />}
                          title="Delete this entry?"
                          description="The tracker total and your available balance will update."
                          confirm="Delete"
                          destructive
                          action={() => deleteTransaction(e.id)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Members</CardTitle>
              <CardDescription>Who&apos;s put in what</CardDescription>
              {!tracker.archived && (
                <CardAction>
                  <ShareButton tracker={tracker} />
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-4">
                {tracker.members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-3">
                    <MemberAvatar name={m.name} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                          {m.name}
                          {m.role === "owner" && <span className="ml-1.5 text-xs text-muted-foreground">owner</span>}
                          {m.role === null && <span className="ml-1.5 text-xs text-muted-foreground">left</span>}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPeso(m.net, { whole: true })}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", m.isMe ? "bg-primary" : "bg-primary/50")}
                          style={{ width: `${Math.max(0, (m.net / biggest) * 100)}%` }}
                        />
                      </div>
                    </div>
                    {isOwner && !m.isMe && m.role === "editor" && (
                      <ConfirmButton
                        size="icon"
                        label={`Remove ${m.name}`}
                        icon={<UserMinus />}
                        title={`Remove ${m.name}?`}
                        description="They won't see this tracker anymore. What they've put in still counts toward the total."
                        confirm="Remove"
                        destructive
                        action={() => removeMember(tracker.id, m.userId)}
                      />
                    )}
                  </li>
                ))}
              </ul>
              {tracker.members.length <= 1 && (
                <p className="mt-4 text-sm text-muted-foreground">Invite a friend to save toward this together. The link works once and expires in 7 days.</p>
              )}
            </CardContent>
          </Card>

          {/* Manage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Manage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {!tracker.archived && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> Edit name, target or date
                </Button>
              )}
              {isOwner ? (
                <ConfirmButton
                  label={tracker.archived ? "Restore tracker" : "Archive tracker"}
                  icon={tracker.archived ? <ArchiveRestore /> : <Archive />}
                  title={tracker.archived ? "Restore this tracker?" : "Archive this tracker?"}
                  description={
                    tracker.archived
                      ? "It moves back to your active trackers."
                      : "It's hidden for everyone and can't take new entries. Money already in it stays set aside until withdrawn."
                  }
                  confirm={tracker.archived ? "Restore" : "Archive"}
                  action={() => setTrackerArchived(tracker.id, !tracker.archived)}
                />
              ) : (
                <ConfirmButton
                  label="Leave tracker"
                  icon={<LogOut />}
                  title="Leave this tracker?"
                  description={
                    (me?.net ?? 0) > 0
                      ? `The ${formatPeso(me!.net)} you put in is withdrawn back to your available balance. You'll need a new invite to rejoin.`
                      : "You'll need a new invite to rejoin."
                  }
                  confirm="Leave"
                  destructive
                  action={() => leaveTracker(tracker.id)}
                  onDone={() => router.push("/trackers")}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!entry} onOpenChange={(open) => !open && setEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{entry?.initial ? "Edit entry" : entry?.type === "withdrawal" ? "Withdraw" : `Add to ${tracker.name}`}</DialogTitle>
          </DialogHeader>
          {entry && overview && (
            <EntryForm
              key={entry.initial?.id ?? entry.type}
              trackerId={tracker.id}
              accounts={overview.accounts}
              available={overview.available}
              myNet={me?.net ?? 0}
              today={today}
              initial={entry.initial}
              defaultType={entry.type}
              onSaved={() => {
                setEntry(null);
                toast.success("Saved");
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit tracker</DialogTitle>
          </DialogHeader>
          <TrackerForm initial={tracker} onSaved={() => setEditing(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// The id is in the query (?id=) rather than the path so this one page can be cached for offline use
function TrackerPage() {
  const id = useSearchParams().get("id");
  const data = useTrackers();
  if (!data) return <Skeleton className="h-96 w-full" />;

  const tracker = data.trackers.find((t) => t.id === id);
  if (!tracker) {
    return (
      <p className="text-muted-foreground">
        This tracker doesn&apos;t exist or you&apos;re no longer a member.{" "}
        <Link href="/trackers" className={linkClass}>
          Back to trackers
        </Link>
      </p>
    );
  }
  return <Tracker tracker={tracker} today={data.today} />;
}

export default function TrackerViewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TrackerPage />
    </Suspense>
  );
}
