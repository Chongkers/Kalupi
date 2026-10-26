import Link from "next/link";
import { CloudOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";

// Shown by the service worker for a page that was never opened online on this device
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo className="h-8" />
      <CloudOff className="size-10 text-muted-foreground" />
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">You&apos;re offline</h1>
        <p className="text-muted-foreground">
          This page hasn&apos;t been saved on this device yet. Open the dashboard; everything you&apos;ve opened before works
          without a connection.
        </p>
      </div>
      <Link href="/" className="font-medium text-primary underline underline-offset-4">
        Go to the dashboard
      </Link>
    </main>
  );
}
