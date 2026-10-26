"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_KIND_LABELS } from "@/lib/finance/types";
import { useOverview } from "@/lib/local/hooks";
import { setAccountArchived, renameAccount } from "@/lib/local/mutations";
import { formatPeso } from "@/lib/money";
import { ManageRow } from "../manage-row";
import { AddAccountForm } from "./add-account-form";

function AccountList() {
  const overview = useOverview();
  if (!overview) return <Skeleton className="h-40 w-full" />;
  const { accounts } = overview;
  const sorted = [...accounts].sort((a, b) => Number(a.archived) - Number(b.archived));

  return (
    <ul className="divide-y">
      {sorted.map((a) => (
        <ManageRow
          key={a.id}
          id={a.id}
          name={a.name}
          details={`${ACCOUNT_KIND_LABELS[a.kind]} · ${formatPeso(a.balance)}`}
          archived={a.archived}
          rename={renameAccount}
          setArchived={setAccountArchived}
        />
      ))}
    </ul>
  );
}

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Accounts" description="Cash, bank and e-wallets. Archive one you no longer use; its history stays." />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Add an account</CardTitle>
          <CardDescription>The starting balance is logged as an Opening balance entry for today.</CardDescription>
        </CardHeader>
        <CardContent>
          <AddAccountForm />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <AccountList />
        </CardContent>
      </Card>
    </>
  );
}
