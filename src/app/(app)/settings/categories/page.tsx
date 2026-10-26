"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview } from "@/lib/local/hooks";
import { renameCategory, setCategoryArchived } from "@/lib/local/mutations";
import { OPENING_BALANCE, type CategoryKind } from "@/lib/finance/types";
import { ManageRow } from "../manage-row";
import { AddCategoryForm } from "./add-category-form";
import { StylePicker } from "./style-picker";

function CategoryList({ kind }: { kind: CategoryKind }) {
  const overview = useOverview();
  if (!overview) return <Skeleton className="h-40 w-full" />;
  const categories = overview.categories
    .filter((c) => c.kind === kind)
    .sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at));

  return (
    <ul className="divide-y">
      {categories.map((c) => (
        <ManageRow
          key={c.id}
          id={c.id}
          name={c.name}
          details={c.name === OPENING_BALANCE ? "Used for starting balances" : undefined}
          icon={<StylePicker category={c} />}
          archived={!!c.archived_at}
          locked={c.name === OPENING_BALANCE}
          rename={renameCategory}
          setArchived={setCategoryArchived}
        />
      ))}
    </ul>
  );
}

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Categories"
        description="Tap an icon to change its look. Archive one to hide it from new entries; past entries keep it."
      />
      <Card>
        <CardContent>
          <AddCategoryForm />
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        {(["expense", "income"] as const).map((kind) => (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{kind === "expense" ? "Expenses" : "Income"}</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryList kind={kind} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
