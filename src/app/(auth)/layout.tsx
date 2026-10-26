import { Logo, WalletArt } from "@/components/brand/logo";

/** Login / signup / forgot password: lavender brand panel + form column (mockups p.5 and p.9). */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-1 flex-col md:grid md:grid-cols-2">
      {/* Fixed dark text: the panel is lavender in both themes.
          On phones it's a compact header so the form stays above the fold. */}
      <section className="flex flex-col gap-4 rounded-b-3xl bg-lavender px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5 text-[#1c1838] md:gap-6 md:rounded-none md:p-12">
        <div className="w-fit rounded-xl bg-white px-3 py-2 shadow-sm md:rounded-2xl md:px-5 md:py-4">
          <Logo className="h-5 md:h-8" priority />
        </div>

        <div className="flex items-center gap-4 md:my-auto md:flex-col md:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-1 md:gap-4">
            {/* Scales with the screen so the wide display type never overflows a small phone */}
            <h2 className="font-display text-[clamp(1.5rem,7.5vw,2.25rem)] leading-tight uppercase tracking-[0.08em] md:text-4xl md:tracking-[0.15em] lg:text-6xl">
              Save together
            </h2>
            <p className="max-w-md text-sm md:text-lg">
              One shared wallet for the two of you.
              <span className="hidden md:inline">
                {" "}Log what comes in and goes out, set budgets, and watch your goals grow.
              </span>
            </p>
          </div>

          {/* The wallet is lavender too, so it sits on a white card to stay visible */}
          <div className="shrink-0 rounded-2xl bg-white p-2 shadow-sm md:hidden">
            <WalletArt className="w-14" />
          </div>
        </div>

        <div className="hidden w-fit items-center gap-4 rounded-2xl bg-white p-4 pr-6 shadow-sm md:flex">
          <WalletArt className="w-16" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#5f5a7a]">Kalupi</span>
            <span className="font-semibold">Budget, track, save. Even offline.</span>
          </div>
        </div>
      </section>

      <section className="flex flex-1 flex-col px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] md:justify-center md:px-12 md:py-8">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-5 md:gap-6">{children}</div>
      </section>
    </div>
  );
}
