import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BottomNav, SidebarNav } from "@/components/app-shell/nav";
import { SyncStatus } from "@/components/app-shell/sync-status";
import { CurrentUserMenu } from "@/components/app-shell/user-menu";
import { LocalDataProvider } from "@/components/local-data-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AddEntryDialog } from "@/components/finance/add-entry";

// Everything here renders on the device from local data, so the whole shell can be cached for offline use
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-1">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 md:flex print:hidden">
        <div className="flex flex-col gap-3 px-2 pt-2">
          <Link href="/">
            <Logo className="h-7" priority />
          </Link>
          <SyncStatus />
        </div>
        <SidebarNav />
        <div className="mt-auto flex flex-col gap-3">
          <ThemeToggle />
          <CurrentUserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between gap-3 px-4 pt-4 md:hidden print:hidden">
          <Link href="/">
            <Logo className="h-6" priority />
          </Link>
          <div className="flex items-center gap-2">
            <SyncStatus />
            <CurrentUserMenu compact />
          </div>
        </div>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-4 pb-28 md:gap-6 md:px-8 md:pt-8 md:pb-8">
          <LocalDataProvider>
            {children}
            <AddEntryDialog />
          </LocalDataProvider>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
