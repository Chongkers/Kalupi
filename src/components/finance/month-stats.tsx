import {
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Gauge,
  Target,
  TriangleAlert,
} from "lucide-react";
import { dayOfMonth, type DateString } from "@/lib/dates";
import type { BudgetSummary } from "@/lib/finance/budget";
import { formatPeso, formatSignedPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

const statLabel =
  "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const pill =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

/** One bar per day of the month; days still to come are empty track, today is outlined. */
function DailyBars({
  days,
  today,
  direction,
}: {
  days: number[];
  today: number;
  direction: "in" | "out";
}) {
  const max = Math.max(...days, 1);
  return (
    <div
      className="flex h-8 items-end gap-px md:h-12 md:gap-[2px]"
      role="img"
      aria-label="Daily totals this month"
    >
      {days.map((amount, i) => {
        const day = i + 1;
        const future = day > today;
        const height =
          future || amount === 0 ? 8 : Math.max(12, (amount / max) * 100);
        return (
          <div
            key={day}
            title={
              future
                ? `Day ${day}`
                : `Day ${day}: ${formatPeso(amount, { whole: true })}`
            }
            className={cn(
              "flex-1 rounded-t-[4px] rounded-b-[1px] transition-opacity hover:opacity-100",
              future || amount === 0
                ? "bg-muted"
                : direction === "in"
                  ? "bg-income opacity-80"
                  : "bg-expense opacity-80",
              day === today && "ring-1 ring-foreground/40",
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

/** "▲ 12% vs Sep" chip. Rising income is good; rising spending is not. */
function Change({
  now,
  before,
  beforeLabel,
  direction,
}: {
  now: number;
  before: number;
  beforeLabel: string;
  direction: "in" | "out";
}) {
  if (before === 0) return null;
  const percent = Math.round(((now - before) / before) * 100);
  const up = percent > 0;
  const good = direction === "in" ? up : !up;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        pill,
        percent === 0
          ? "bg-muted text-muted-foreground"
          : good
            ? "bg-income/15 text-income"
            : "bg-expense/15 text-expense",
      )}
    >
      <Arrow className="size-3.5" />
      {Math.abs(percent)}% vs {beforeLabel}
    </span>
  );
}

/** Money in or out this month: total, change against last month to date, and a bar per day. */
export function FlowStat({
  direction,
  days,
  today,
  lastMonthToDate,
  lastMonthLabel,
  footer,
}: {
  direction: "in" | "out";
  days: number[];
  today: DateString;
  lastMonthToDate: number;
  lastMonthLabel: string;
  footer: React.ReactNode;
}) {
  const { day } = dayOfMonth(today);
  const total = days.reduce((sum, d) => sum + d, 0);
  return (
    <div className="flex h-full flex-col gap-2 md:gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <span className={cn(statLabel, "whitespace-nowrap")}>
          {direction === "in" ? "In this month" : "Out this month"}
        </span>
        <Change
          now={total}
          before={lastMonthToDate}
          beforeLabel={lastMonthLabel}
          direction={direction}
        />
      </div>
      <span
        className={cn(
          "text-lg font-bold tabular-nums md:text-2xl",
          direction === "in" ? "text-income" : "text-expense",
        )}
      >
        {formatSignedPeso(total, direction)}
      </span>
      <DailyBars days={days} today={day} direction={direction} />
      {/* Phones skip the footer to keep the dashboard on one screen */}
      <div className="hidden text-sm text-muted-foreground md:block">
        {footer}
      </div>
    </div>
  );
}

/** Days in a row with no spending, counting back from today (or yesterday, if today has some). */
export function noSpendStreak(expenseDays: number[], today: number): number {
  let streak = 0;
  for (let i = today - 1; i >= 0 && expenseDays[i] === 0; i--) streak++;
  return streak;
}

export function StreakPill({ days }: { days: number }) {
  if (days < 1) return null;
  return (
    <span className={cn(pill, "bg-primary/15 text-foreground")}>
      <Flame className="size-3.5 text-primary" />
      {days}-day no-spend streak
    </span>
  );
}

// Gauge geometry: a 270° arc opening at the bottom, drawn on a 100×100 viewBox
const SWEEP = 270;
const START = 135; // degrees clockwise from +x
const RADIUS = 40;

function pointOnArc(fraction: number, radius: number) {
  const angle = ((START + SWEEP * fraction) * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
}

/** Month budget as a dial, with a tick for where spending "should" be today and a status badge. */
export function BudgetDial({
  budget,
  today,
}: {
  budget: BudgetSummary;
  today: DateString;
}) {
  const { day, of } = dayOfMonth(today);
  const daysLeft = of - day + 1; // today counts
  const left = budget.totalLimit - budget.totalSpent;
  const over = left < 0;
  const pace = (day / of) * 100; // where an even spender would be by end of today
  const fill = Math.min(100, Math.max(0, budget.percentUsed));

  const status = over
    ? {
        label: "Over budget",
        icon: TriangleAlert,
        className: "bg-expense/15 text-expense",
      }
    : budget.percentUsed > pace + 10
      ? {
          label: "Spending fast",
          icon: Gauge,
          className: "bg-expense/15 text-expense",
        }
      : {
          label: "On track",
          icon: Target,
          className: "bg-income/15 text-income",
        };
  const StatusIcon = status.icon;

  // The pace tick crosses only the ring's band, so it never runs into the number in the middle
  const tickInner = pointOnArc(pace / 100, RADIUS - 5);
  const tickOuter = pointOnArc(pace / 100, RADIUS + 5);
  // Three digits ("127%") need a smaller size to fit inside the ring
  const percentText = `${Math.min(budget.percentUsed, 999)}%`;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0 md:size-28">
          <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
            <g
              transform={`rotate(${START} 50 50)`}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
            >
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                pathLength={360}
                strokeDasharray={`${SWEEP} 360`}
                className="stroke-muted"
              />
              {fill > 0 && (
                <circle
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  pathLength={360}
                  strokeDasharray={`${(SWEEP * fill) / 100} 360`}
                  className={cn(
                    "transition-[stroke-dasharray] duration-700",
                    over ? "stroke-expense" : "stroke-primary",
                  )}
                />
              )}
            </g>
            {/* Pace doesn't matter once the month's limit is gone */}
            {!over && (
              <line
                x1={tickInner.x}
                y1={tickInner.y}
                x2={tickOuter.x}
                y2={tickOuter.y}
                strokeWidth="2.5"
                strokeLinecap="round"
                className="stroke-foreground/70"
              >
                <title>Even pace for today: {Math.round(pace)}%</title>
              </line>
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={cn(
                "font-bold tabular-nums",
                percentText.length > 3
                  ? "text-lg md:text-2xl"
                  : "text-2xl md:text-3xl",
              )}
            >
              {percentText}
            </span>
            <span className="-mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              used
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            className={cn(
              pill,
              "self-start whitespace-nowrap",
              status.className,
            )}
          >
            <StatusIcon className="size-3.5" />
            {status.label}
          </span>
          <span className="flex flex-col leading-tight tabular-nums">
            <span
              className={cn("text-base font-semibold", over && "text-expense")}
            >
              {formatPeso(budget.totalSpent, { whole: true })}
            </span>
            <span className="text-xs text-muted-foreground">
              of {formatPeso(budget.totalLimit, { whole: true })} · {daysLeft}{" "}
              {daysLeft === 1 ? "day" : "days"} left
            </span>
          </span>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-sm md:pt-3">
        <span className="text-muted-foreground">
          {over ? "Over by" : "Safe to spend"}
        </span>
        <span
          className={cn("font-semibold tabular-nums", over && "text-expense")}
        >
          {over
            ? formatPeso(-left, { whole: true })
            : `${formatPeso(Math.floor(left / daysLeft), { whole: true })} a day`}
        </span>
      </div>
    </div>
  );
}
