"use client";

import { Mail, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CONTACT_EMAIL, deleteAccountMailto } from "@/lib/legal";

/**
 * For now deletion is by request: this opens an email to CONTACT_EMAIL, and the admin deletes the
 * user in Supabase (docs/launch.md, "Deleting an account"). In-app deletion comes later.
 */
export function DeleteAccount({ email }: { email: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="border-destructive/40 text-destructive">
          <Trash2 /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              <p>
                This deletes your account and everything in it: entries, budgets, trackers you made and your picture.
                On shared trackers, your contributions are removed too. It can&apos;t be undone.
              </p>
              <p>
                Send the request from the email below. Your account is deleted within 7 days, and you&apos;ll get a
                reply when it&apos;s done. If your mail app doesn&apos;t open, email <strong>{CONTACT_EMAIL}</strong> from{" "}
                <strong>{email}</strong>.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button asChild variant="destructive">
            <a href={deleteAccountMailto(email)}>
              <Mail /> Email the request
            </a>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
