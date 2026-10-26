import Image from "next/image";
import { cn } from "@/lib/utils";

/** Wallet + KALUPI wordmark. Lavender on transparent: use it on white or dark ink, not on lavender. */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/kalupi-logo.png"
      alt="Kalupi"
      width={1461}
      height={336}
      priority={priority}
      className={cn("h-8 w-auto", className)}
    />
  );
}

/** The wallet on its own, for auth screens and empty states. */
export function WalletArt({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/kalupi-wallet.png"
      alt=""
      width={1208}
      height={1124}
      className={cn("h-auto w-48", className)}
    />
  );
}
