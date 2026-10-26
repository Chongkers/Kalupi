"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { setMeta } from "@/lib/local/db";
import { updateDisplayName, type ProfileState } from "./actions";

const initialState: ProfileState = {};

export function ProfileForm({ displayName, email }: { displayName: string; email: string }) {
  // Profiles aren't synced offline, so saving needs a connection
  const [state, formAction, isPending] = useActionState(async (prev: ProfileState, formData: FormData) => {
    if (!navigator.onLine) return { error: "You're offline. Connect to change your display name." };
    try {
      const result = await updateDisplayName(prev, formData);
      if (result.saved) await setMeta("displayName", String(formData.get("displayName") ?? "").trim());
      return result;
    } catch {
      return { error: "Couldn't reach the server. Try again." };
    }
  }, initialState);

  useEffect(() => {
    if (state.saved) toast.success("Display name saved");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="displayName">Display name</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="displayName"
            name="displayName"
            autoComplete="nickname"
            defaultValue={displayName}
            maxLength={40}
            required
            aria-invalid={!!state.error}
            className="h-10 bg-secondary"
          />
          <Button type="submit" size="lg" disabled={isPending} className="h-10">
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        <FieldDescription>Shown to friends you share a tracker with.</FieldDescription>
        <FieldError>{state.error}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" value={email} readOnly disabled className="h-10" />
      </Field>
    </form>
  );
}
