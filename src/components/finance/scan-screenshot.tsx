"use client";

import { useRef, useState } from "react";
import { Check, ScanText, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findAmounts, type AmountCandidate } from "@/lib/finance/scan";
import { readText, type OcrProgress } from "@/lib/scan/ocr";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

type State =
  | { step: "idle" }
  | { step: "working"; progress: OcrProgress }
  | { step: "done"; candidates: AmountCandidate[]; picked: number | null }
  | { step: "error"; message: string };

/**
 * Pick a bank or e-wallet screenshot; the amount is read on the device and handed to the form.
 * The image is only held in memory while reading, never saved or uploaded.
 */
export function ScanScreenshot({ onAmount }: { onAmount: (centavos: number | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: "idle" });

  async function scan(file: File) {
    setState({ step: "working", progress: { stage: "loading", percent: 0 } });
    try {
      const text = await readText(file, (progress) => setState({ step: "working", progress }));
      const candidates = findAmounts(text).slice(0, 5);
      const picked = candidates[0]?.amount ?? null;
      setState({ step: "done", candidates, picked });
      onAmount(picked);
    } catch {
      setState({
        step: "error",
        message: navigator.onLine
          ? "Couldn't read that image. Try a clearer screenshot."
          : "The first scan needs the internet to download the reader. After that it works offline.",
      });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  const pick = (amount: number | null) => {
    if (state.step === "done") setState({ ...state, picked: amount });
    onAmount(amount);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed p-3">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void scan(file);
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="font-medium">Scan a screenshot</span>
          <span className="text-sm text-muted-foreground">GCash, Maya or bank receipt. Read on your phone, not uploaded.</span>
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={state.step === "working"}
          onClick={() => input.current?.click()}
          className="shrink-0"
        >
          <ScanText /> {state.step === "done" || state.step === "error" ? "Another" : "Pick"}
        </Button>
      </div>

      {state.step === "working" && (
        <div className="flex flex-col gap-1.5" role="status">
          <span className="text-sm text-muted-foreground">
            {state.progress.stage === "loading" ? "Getting the reader ready…" : `Reading… ${state.progress.percent}%`}
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${state.progress.stage === "loading" ? 10 : 10 + state.progress.percent * 0.9}%` }}
            />
          </div>
        </div>
      )}

      {state.step === "error" && (
        <p className="flex items-start gap-2 text-sm text-expense">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {state.message}
        </p>
      )}

      {state.step === "done" &&
        (state.candidates.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> No amount found. Type it in below.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">
              {state.candidates.length > 1 ? "Found these. Tap the right one:" : "Found this amount. Check it below."}
            </span>
            <div className="flex flex-wrap gap-2">
              {state.candidates.map((c) => (
                <button
                  key={c.amount}
                  type="button"
                  title={c.line}
                  aria-pressed={state.picked === c.amount}
                  onClick={() => pick(c.amount)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors hover:bg-accent",
                    "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground",
                  )}
                >
                  {state.picked === c.amount && <Check className="size-3.5" />}
                  {formatPeso(c.amount)}
                </button>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
