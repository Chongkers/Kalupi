import { CloudOff, PiggyBank, ReceiptText, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const FEATURES = [
  { icon: ReceiptText, label: "Track every peso in and out" },
  { icon: Users, label: "Share a tracker with friends or a partner" },
  { icon: PiggyBank, label: "Set budgets and grow savings goals" },
  { icon: CloudOff, label: "Works offline, syncs when you're back" },
];

/** Login / signup / forgot password: dark ink brand panel + form column. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-1 flex-col md:grid md:grid-cols-2">
      {/* Fixed colors: the panel is dark ink in both themes, so the lavender logo sits on it directly.
          On phones it's a compact header so the form stays above the fold. */}
      <section className="flex flex-col gap-4 rounded-b-[50%_4rem] bg-[#1c1838] px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-14 text-center text-[#f1effa] md:text-left md:gap-6 md:rounded-none md:p-12">
        <Logo className="h-7 w-fit self-center md:h-8 md:self-start" priority />

        <div className="flex flex-col items-center gap-4 md:my-auto md:items-start">
          <div className="flex min-w-0 flex-col items-center gap-1 md:items-start md:gap-4">
            {/* One line at every width: sized from the panel width (15 wide glyphs ≈ 17em incl. tracking) */}
            <h2 className="font-display text-[min(calc((100vw_-_3rem)/17),2.25rem)] leading-tight whitespace-nowrap uppercase tracking-[0.1em] md:text-[min(calc((50vw_-_6rem)/17),3.75rem)]">
              Money, together
            </h2>
            <p className="max-w-md text-sm text-[#c9c4e6] md:text-lg">
              Your finances, all in one place.
              <span className="hidden md:inline">
                {" "}Log what you earn and spend, stay on budget, and reach your goals, on your own or side by side
                with the people you share costs with.
              </span>
            </p>
          </div>
        </div>

        <ul className="hidden flex-col gap-3 md:flex">
          {FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lavender">
                <Icon className="size-5" />
              </span>
              <span className="font-medium">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-1 flex-col px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] md:justify-center md:px-12 md:py-8">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-5 md:gap-6">{children}</div>
      </section>
    </div>
  );
}
