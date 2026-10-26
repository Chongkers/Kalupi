"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/finance/transaction-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview } from "@/lib/local/hooks";
import { DeleteTransactionButton } from "./delete-button";

// The id is in the query (?id=) rather than the path so this one page can be cached for offline use
function Editor() {
  const id = useSearchParams().get("id");
  const overview = useOverview();
  if (!overview) return <Skeleton className="h-[32rem] w-full" />;

  const transaction = overview.transactions.find((t) => t.id === id);
  if (!transaction) {
    return (
      <p className="text-muted-foreground">
        This entry doesn&apos;t exist or was deleted.{" "}
        <Link href="/transactions" className="font-medium text-primary underline underline-offset-4">
          Back to transactions
        </Link>
      </p>
    );
  }

  // Tracker entries, split bills and paybacks
  if (transaction.tracker_id) {
    return (
      <p className="text-muted-foreground">
        Tracker entries are edited from their tracker.{" "}
        <Link href={`/trackers/view?id=${transaction.tracker_id}`} className="font-medium text-primary underline underline-offset-4">
          Open the tracker
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <TransactionForm
        key={transaction.id}
        accounts={overview.accounts}
        categories={overview.categories}
        available={overview.available}
        budget={overview.budget}
        today={overview.today}
        initial={transaction}
      />
      <DeleteTransactionButton id={transaction.id} />
    </div>
  );
}

export default function EditTransactionPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader title="Edit entry" />
      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-[32rem] w-full" />}>
            <Editor />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
