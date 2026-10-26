"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PrivacyText, TermsText } from "./legal-text";

const DOCS = {
  terms: { title: "Terms and Conditions", description: "The rules for using Kalupi.", Text: TermsText },
  privacy: { title: "Privacy Policy", description: "What Kalupi keeps about you.", Text: PrivacyText },
};

/** Opens the Terms or Privacy Policy in a scrollable modal. The trigger is whatever you pass as children. */
export function LegalDialog({ doc, children }: { doc: keyof typeof DOCS; children: React.ReactNode }) {
  const { title, description, Text } = DOCS[doc];
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 p-5 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 overflow-y-auto px-1">
          <Text />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button size="lg">Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline text button that opens a LegalDialog, for use inside sentences */
export function LegalLink({ doc, children }: { doc: keyof typeof DOCS; children: React.ReactNode }) {
  return (
    <LegalDialog doc={doc}>
      <button type="button" className="font-medium text-primary underline underline-offset-2">
        {children}
      </button>
    </LegalDialog>
  );
}
