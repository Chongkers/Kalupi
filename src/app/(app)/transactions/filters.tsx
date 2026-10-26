"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import type { Category } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export type FilterValues = { month: string; type: string; account: string; category: string; q: string };

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "income", label: "In" },
  { value: "expense", label: "Out" },
  { value: "transfer", label: "Transfers" },
];

/** Search, type tabs and dropdowns. Every change is written to the URL so the list is shareable and survives reloads. */
export function TransactionFilters({
  values,
  accounts,
  categories,
}: {
  values: FilterValues;
  accounts: { id: string; name: string }[];
  categories: Category[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(values.q);

  function update(patch: Partial<FilterValues>) {
    const next = { ...values, ...patch };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all") params.set(key, value);
    }
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  // Search as you type, after a short pause
  useEffect(() => {
    if (query === values.q) return;
    const timer = setTimeout(() => update({ q: query }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [query]);

  return (
    <div className={cn("flex flex-col gap-3 transition-opacity", isPending && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Type" className="flex gap-1 rounded-xl bg-muted p-1">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={values.type === tab.value}
              onClick={() => update({ type: tab.value })}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-sm"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search transactions"
            placeholder="Search notes, categories, accounts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 bg-secondary pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <NativeSelect
          aria-label="Account"
          value={values.account}
          onChange={(e) => update({ account: e.target.value })}
          selectClassName="h-10"
        >
          <NativeSelectOption value="">All accounts</NativeSelectOption>
          {accounts.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {a.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          aria-label="Category"
          value={values.category}
          onChange={(e) => update({ category: e.target.value })}
          selectClassName="h-10"
        >
          <NativeSelectOption value="">All categories</NativeSelectOption>
          {(["expense", "income"] as const).map((kind) => (
            <NativeSelectOptGroup key={kind} label={kind === "expense" ? "Expenses" : "Income"}>
              {categories
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
