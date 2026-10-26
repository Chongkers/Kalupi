import { Logo, WalletArt } from "@/components/brand/logo";

/** Login / signup / forgot password: lavender brand panel + form column (mockups p.5 and p.9). */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-1 flex-col md:grid md:grid-cols-2">
      {/* Fixed dark text: the panel is lavender in both themes */}
      <section className="flex flex-col gap-6 bg-lavender p-6 text-[#1c1838] md:p-12">
        <div className="w-fit rounded-2xl bg-white px-5 py-4 shadow-sm">
          <Logo className="h-6 md:h-8" priority />
        </div>

        <div className="flex flex-col gap-4 md:my-auto">
          <h2 className="font-display text-4xl leading-tight uppercase tracking-[0.15em] lg:text-6xl">
            Save together
          </h2>
          <p className="max-w-md text-base md:text-lg">
            One shared wallet for the two of you.
            <span className="hidden md:inline">
              {" "}Log what comes in and goes out, set budgets, and watch your goals grow.
            </span>
          </p>
        </div>

        {/* The wallet is lavender too, so it sits on a white card to stay visible */}
        <div className="hidden w-fit items-center gap-4 rounded-2xl bg-white p-4 pr-6 shadow-sm md:flex">
          <WalletArt className="w-16" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#5f5a7a]">Kalupi</span>
            <span className="font-semibold">Budget, track, save. Even offline.</span>
          </div>
        </div>
      </section>

      <section className="flex flex-1 flex-col px-6 py-8 md:justify-center md:px-12">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">{children}</div>
      </section>
    </div>
  );
}
