import { ProfileAvatar } from "@/components/profile-avatar";
import { cn } from "@/lib/utils";

/** A full-circle progress ring with the percent in the middle. Turns income-green once the goal is reached. */
export function ProgressRing({
  percent,
  size = "size-24",
  label = "saved",
  compact,
  className,
}: {
  percent: number;
  size?: string;
  label?: string;
  /** Small rings: smaller number, no label */
  compact?: boolean;
  className?: string;
}) {
  const fill = Math.min(100, Math.max(0, percent));
  const done = percent >= 100;
  return (
    <div className={cn("relative shrink-0", size, className)}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-muted" />
        {fill > 0 && (
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${fill} 100`}
            className={cn("transition-[stroke-dasharray] duration-700", done ? "stroke-income" : "stroke-primary")}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold tabular-nums", compact ? "text-xs" : "text-xl")}>{Math.round(percent)}%</span>
        {!compact && <span className="-mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

const MILESTONES = [25, 50, 75, 100];

/** Four badges that light up as the tracker passes 25 / 50 / 75 / 100%. */
export function Milestones({ percent }: { percent: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Milestones">
      {MILESTONES.map((m) => {
        const reached = percent >= m;
        return (
          <li
            key={m}
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              reached ? (m === 100 ? "bg-income/15 text-income" : "bg-primary/15 text-foreground") : "bg-muted text-muted-foreground",
            )}
            aria-label={`${m}% ${reached ? "reached" : "not yet"}`}
          >
            {m === 100 ? (reached ? "🏆 Goal" : "Goal") : `${m}%`}
          </li>
        );
      })}
    </ol>
  );
}

/** A member's picture (or initials), ringed so overlapping avatars stay distinct. */
export function MemberAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return <ProfileAvatar name={name} src={src} className={cn("size-9 shrink-0 text-xs ring-2 ring-card", className)} />;
}
