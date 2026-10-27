"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartPie, Goal, House, List, PhilippinePeso, ReceiptText, SlidersHorizontal } from "lucide-react";
import { AddEntryLink } from "@/components/finance/add-entry";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { href: "/", label: "Dashboard", icon: House },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/budgets", label: "Budget", icon: ChartPie },
  { href: "/bills", label: "Bills", icon: ReceiptText },
  { href: "/trackers", label: "Trackers", icon: Goal },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];

// Roadmap Phase 2: Dashboard · Transactions · Trackers · History
const bottomItems = [
  { href: "/", label: "Dashboard", icon: House },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/trackers", label: "Trackers", icon: Goal },
  { href: "/history", label: "History", icon: CalendarDays },
];

type IsActive = (href: string) => boolean;
const noneActive: IsActive = () => false;

function useIsActive(): IsActive {
  const pathname = usePathname();
  return (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

// The current URL is only known at request time on dynamic routes like /transactions/[id],
// so the links prerender without a highlight and the active one lights up when it streams in.
function WithActive({ render }: { render: (isActive: IsActive) => React.ReactNode }) {
  return render(useIsActive());
}

/** Desktop sidebar links. */
export function SidebarNav() {
  return (
    <Suspense fallback={<SidebarLinks isActive={noneActive} />}>
      <WithActive render={(isActive) => <SidebarLinks isActive={isActive} />} />
    </Suspense>
  );
}

function SidebarLinks({ isActive }: { isActive: IsActive }) {
  return (
    <nav className="flex flex-col gap-1">
      {sidebarItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
            "aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile bottom bar: two icon tabs, the add button (₱), two icon tabs. Names are in aria-label. */
export function BottomNav() {
  return (
    <Suspense fallback={<BottomLinks isActive={noneActive} />}>
      <WithActive render={(isActive) => <BottomLinks isActive={isActive} />} />
    </Suspense>
  );
}

function BottomLinks({ isActive }: { isActive: IsActive }) {
  const [left, right] = [bottomItems.slice(0, 2), bottomItems.slice(2)];

  const tab = ({ href, label, icon: Icon }: (typeof bottomItems)[number]) => (
    <Link
      key={href}
      href={href}
      aria-current={isActive(href) ? "page" : undefined}
      aria-label={label}
      title={label}
      className="flex flex-1 items-center justify-center py-4 text-muted-foreground aria-[current=page]:text-primary"
    >
      <Icon className="size-6" />
    </Link>
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
      <div className="mx-auto flex max-w-md items-center px-2">
        {left.map(tab)}
        {/* Bell-shaped add button: the same height as the bar, flaring out at the bottom and
            running down through the safe area to the very bottom of the screen */}
        <div className="relative flex-1 self-stretch">
          <AddEntryLink
            aria-label="Add entry"
            className="group absolute bottom-[calc(-1*env(safe-area-inset-bottom))] left-1/2 flex w-30 -translate-x-1/2 flex-col text-primary-foreground drop-shadow-md transition-transform active:scale-95"
          >
            <svg viewBox="0 0 120 56" className="block h-14 w-30 fill-primary" aria-hidden>
              <path d="M0 56C20 56 24 48 27 38C30.6 26 42 4 60 4S89.4 26 93 38C96 48 100 56 120 56Z" />
            </svg>
            {/* Fills the safe area under the bell on phones with a home indicator */}
            <span className="h-[env(safe-area-inset-bottom)] w-full bg-primary" />
            <PhilippinePeso className="absolute top-4 left-1/2 size-6 -translate-x-1/2" />
          </AddEntryLink>
        </div>
        {right.map(tab)}
      </div>
    </nav>
  );
}
