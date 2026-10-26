"use client";

import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { logOutOfDevice } from "@/components/app-shell/logout";
import { LegalDialog } from "@/components/legal/legal-dialog";
import { useLocalProfile } from "@/lib/local/hooks";
import { DeleteAccount } from "./delete-account";
import { ProfileForm } from "./profile-form";
import { ThemePicker } from "./theme-picker";
import { version } from "../../../../package.json";

function Profile() {
  const profile = useLocalProfile();
  if (!profile) return <Skeleton className="h-36 w-full" />;

  return (
    <ProfileForm
      displayName={profile.hasDisplayName ? profile.displayName : ""}
      email={profile.email}
      avatarUrl={profile.avatarUrl}
    />
  );
}

function DeleteAccountButton() {
  const profile = useLocalProfile();
  if (!profile) return <Skeleton className="h-9 w-24" />;
  return <DeleteAccount email={profile.email} />;
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your account and how Kalupi looks" />

      {/* items-start: the profile card is only as tall as its content */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Profile</CardTitle>
            <CardDescription>How you appear in Kalupi.</CardDescription>
          </CardHeader>
          <CardContent>
            <Profile />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Money setup</CardTitle>
              <CardDescription>Where your money sits and how you sort it.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild variant="outline" size="lg" className="h-11 justify-between">
                <Link href="/settings/accounts">
                  Accounts <ChevronRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 justify-between">
                <Link href="/settings/categories">
                  Categories <ChevronRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 justify-between">
                <Link href="/settings/presets">
                  Presets <ChevronRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 justify-between">
                <Link href="/settings/import">
                  Import from Tarsi <ChevronRight />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Theme</CardTitle>
              <CardDescription>System follows your phone&apos;s setting.</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemePicker />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">Log out</span>
                <span className="text-sm text-muted-foreground">Also clears Kalupi&apos;s data from this device.</span>
              </div>
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive"
                onClick={() => void logOutOfDevice()}
              >
                <LogOut /> Log out
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Terms and privacy</CardTitle>
              <CardDescription>What you agreed to, and what Kalupi keeps about you.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <LegalDialog doc="terms">
                <Button variant="outline" size="lg" className="h-11 justify-between">
                  Terms and Conditions <ChevronRight />
                </Button>
              </LegalDialog>
              <LegalDialog doc="privacy">
                <Button variant="outline" size="lg" className="h-11 justify-between">
                  Privacy Policy <ChevronRight />
                </Button>
              </LegalDialog>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">Delete account</span>
                <span className="text-sm text-muted-foreground">Removes your account and all its data for good.</span>
              </div>
              <DeleteAccountButton />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Required by the heading font's CC BY 4.0 licence */}
      <p className="text-center text-xs text-muted-foreground">
        Kalupi v{version} ·{" "}
        Fonts made from{" "}
        <a href="http://www.onlinewebfonts.com" className="underline underline-offset-2" target="_blank" rel="noreferrer">
          Web Fonts
        </a>{" "}
        is licensed by CC BY 4.0
      </p>
    </>
  );
}
