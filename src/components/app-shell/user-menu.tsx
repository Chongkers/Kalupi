"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut, SlidersHorizontal } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalProfile } from "@/lib/local/hooks";
import { cn } from "@/lib/utils";
import { logOutOfDevice } from "./logout";

export type UserSummary = { displayName: string; email: string; avatarUrl?: string | null };

/** The signed-in user's menu, from the profile cached on this device (works offline). */
export function CurrentUserMenu({ compact, className }: { compact?: boolean; className?: string }) {
  const profile = useLocalProfile();
  return <UserMenu user={profile ?? { displayName: " ", email: "" }} compact={compact} className={className} />;
}

/** Sidebar footer / mobile header button with settings and logout. */
export function UserMenu({ user, compact, className }: { user: UserSummary; compact?: boolean; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex items-center gap-3 rounded-xl text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "p-1" : "w-full border bg-card p-3",
          className
        )}
      >
        <ProfileAvatar name={user.displayName} src={user.avatarUrl} />
        {!compact && (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{user.displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SlidersHorizontal /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logOutOfDevice()}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
