"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SetupWizard } from "./setup-wizard";

/**
 * The startup wizard over the blurred dashboard. It can't be dismissed: the app needs at least
 * one account, so it only goes away once setup is saved (the dashboard then stops rendering it).
 */
export function SetupDialog({ expenseCategories }: { expenseCategories: { id: string; name: string }[] }) {
  const stay = (event: Event) => event.preventDefault();

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={stay}
        onPointerDownOutside={stay}
        onInteractOutside={stay}
        className="flex max-h-[calc(100svh-2rem)] flex-col gap-5 overflow-y-auto p-5 sm:max-w-xl sm:p-6"
      >
        <SetupWizard expenseCategories={expenseCategories} />
      </DialogContent>
    </Dialog>
  );
}
