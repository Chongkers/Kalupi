"use client";

import { PageHeader } from "@/components/page-header";
import { AddEntryForm } from "@/components/finance/add-entry";
import { Card, CardContent } from "@/components/ui/card";

// The buttons open Add entry as a modal (v1.0.5); this page stays for links and before data is ready
export default function AddEntryPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader title="Add entry" description="Log money in, out, or between accounts" />
      <Card>
        <CardContent>
          <AddEntryForm />
        </CardContent>
      </Card>
    </div>
  );
}
