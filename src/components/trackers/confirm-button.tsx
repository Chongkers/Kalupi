"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Confirm, then run an action that returns { error }. */
export function ConfirmButton({
  label,
  icon,
  title,
  description,
  confirm,
  destructive,
  action,
  onDone,
  size,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  confirm: string;
  destructive?: boolean;
  action: () => Promise<{ error?: string }>;
  onDone?: () => void;
  size?: "icon";
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant={size ? "ghost" : "outline"}
            size={size}
            aria-label={size ? label : undefined}
            disabled={isPending}
            className={cn(destructive && !size && "border-destructive/40 text-destructive", destructive && size && "text-destructive")}
          >
            {icon}
            {!size && label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={destructive ? "destructive" : "default"}
              onClick={() =>
                startTransition(async () => {
                  const result = await action();
                  setError(result.error);
                  if (result.error) toast.error(result.error);
                  else onDone?.();
                })
              }
            >
              {confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && !size && <FieldError>{error}</FieldError>}
    </>
  );
}
