"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Goal, TriangleAlert } from "lucide-react";
import { submitClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/local/db";
import { acceptInvite, getInvite, type InviteDetails } from "@/lib/trackers/invites";

const linkClass = "font-medium text-primary underline underline-offset-4";

const PROBLEMS: Record<Exclude<InviteDetails["status"], "valid" | "member">, string> = {
  used: "This invite link was already used. Ask for a new one.",
  expired: "This invite link expired. Ask for a new one.",
  revoked: "This invite link was cancelled.",
};

function Invite() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<{ invite?: InviteDetails | null; error?: string }>();
  const [joinError, setJoinError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void getInvite(token).then(setState);
  }, [token]);

  const open = (trackerId: string) =>
    startTransition(async () => {
      // The tracker's rows are older than this device's sync cursor; pull them from the start
      await db.meta.bulkDelete(["cursor:trackers", "cursor:tracker_members"]);
      router.push(`/trackers/view?id=${trackerId}`);
    });

  if (!state) return <Skeleton className="h-40 w-full" />;

  const invite = state.invite;
  if (state.error || !invite) {
    return (
      <Problem text={state.error ?? "This invite link doesn't exist. Check that you copied all of it."} />
    );
  }
  if (invite.status !== "valid" && invite.status !== "member") return <Problem text={PROBLEMS[invite.status]} />;

  return (
    <>
      <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Goal className="size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">{invite.tracker_name}</h1>
        <p className="text-muted-foreground">
          {invite.status === "member"
            ? "You're already saving toward this one."
            : `${invite.invited_by ?? "A friend"} invited you to save toward this together.`}
        </p>
      </div>

      {invite.status === "member" ? (
        <Button size="lg" className={submitClass} disabled={isPending} onClick={() => open(invite.tracker_id)}>
          Open tracker
        </Button>
      ) : (
        <>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            <li>You&apos;ll both see the total and each person&apos;s share.</li>
            <li>Your other spending stays private.</li>
          </ul>
          <Button
            size="lg"
            className={submitClass}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await acceptInvite(token);
                setJoinError(result.error);
                if (result.trackerId) open(result.trackerId);
              })
            }
          >
            {isPending ? "Joining…" : "Join tracker"}
          </Button>
          <FieldError>{joinError}</FieldError>
        </>
      )}
    </>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <>
      <div className="flex items-start gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        {text}
      </div>
      <Link href="/" className={linkClass}>
        Go to your dashboard
      </Link>
    </>
  );
}

/** /invite/[token]: logged-out visitors are sent to log in first and come back here (see proxy.ts). */
export default function InvitePage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <Invite />
    </Suspense>
  );
}
