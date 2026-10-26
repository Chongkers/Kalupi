"use client";

import { useActionState, useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ManageState = { error?: string };

/** One account or category: name and details, with inline rename and archive / restore. */
export function ManageRow({
  id,
  name,
  details,
  archived,
  locked,
  rename,
  setArchived,
}: {
  id: string;
  name: string;
  details?: React.ReactNode;
  archived: boolean;
  /** Built-in rows (Opening balance) can't be renamed or archived */
  locked?: boolean;
  rename: (id: string, name: string) => Promise<ManageState>;
  setArchived: (id: string, archived: boolean) => Promise<ManageState>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isSaving] = useActionState(async (_prev: ManageState, formData: FormData) => {
    const result = await rename(id, String(formData.get("name") ?? ""));
    if (!result.error) setEditing(false);
    return result;
  }, {});
  const [archiveError, setArchiveError] = useState<string>();
  const [isArchiving, startTransition] = useTransition();

  return (
    <li className={cn("flex flex-col gap-2 py-3", archived && "opacity-60")}>
      {editing ? (
        <form action={formAction} className="flex gap-2">
          <Input name="name" defaultValue={name} aria-label="New name" required maxLength={40} autoFocus className="h-10 bg-secondary" />
          <Button type="submit" disabled={isSaving} className="h-10">
            Save
          </Button>
          <Button type="button" variant="ghost" className="h-10" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">
              {name}
              {archived && <span className="ml-2 text-xs font-semibold uppercase text-muted-foreground">Archived</span>}
            </span>
            {details && <span className="text-sm text-muted-foreground">{details}</span>}
          </div>
          {!locked && (
            <>
              <Button variant="ghost" size="icon" aria-label={`Rename ${name}`} onClick={() => setEditing(true)}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={archived ? `Restore ${name}` : `Archive ${name}`}
                disabled={isArchiving}
                onClick={() =>
                  startTransition(async () => {
                    const result = await setArchived(id, !archived);
                    setArchiveError(result.error);
                  })
                }
              >
                {archived ? <ArchiveRestore /> : <Archive />}
              </Button>
            </>
          )}
        </div>
      )}
      <FieldError>{state.error ?? archiveError}</FieldError>
    </li>
  );
}
