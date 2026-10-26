"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ScanScreenshot } from "@/components/finance/scan-screenshot";
import { TransactionForm } from "@/components/finance/transaction-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview } from "@/lib/local/hooks";

export default function AddEntryPage() {
  const overview = useOverview();
  const [scanned, setScanned] = useState<number | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader title="Add entry" description="Log money in, out, or between accounts" />
      <Card>
        <CardContent className="flex flex-col gap-6">
          <ScanScreenshot onAmount={setScanned} />
          {overview ? (
            <TransactionForm
              accounts={overview.accounts}
              categories={overview.categories}
              available={overview.available}
              budget={overview.budget}
              today={overview.today}
              scannedAmount={scanned}
              presets={overview.presets}
            />
          ) : (
            <Skeleton className="h-[32rem] w-full" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
