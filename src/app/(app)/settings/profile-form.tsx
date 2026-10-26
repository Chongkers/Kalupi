"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { setMeta } from "@/lib/local/db";
import { ACCEPTED_TYPES, removeAvatar, uploadAvatar } from "@/lib/profile/avatar";
import { updateDisplayName, type ProfileState } from "./actions";

const initialState: ProfileState = {};

/** Picture with change / remove. PNG, JPG, WebP or GIF; shrunk on the device before upload. */
function ProfilePicture({ name, src }: { name: string; src: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string }>, done: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success(done);
    });

  return (
    <div className="flex items-center gap-4">
      <ProfileAvatar name={name} src={src} className="size-20 text-2xl" />
      <div className="flex flex-col gap-2">
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) run(() => uploadAvatar(file), "Picture updated");
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => input.current?.click()}>
            <Camera /> {isPending ? "Saving…" : src ? "Change picture" : "Add a picture"}
          </Button>
          {src && (
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => run(removeAvatar, "Picture removed")}>
              <Trash2 /> Remove
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">PNG, JPG, WebP or GIF. Your tracker partners see it too.</span>
      </div>
    </div>
  );
}

export function ProfileForm({ displayName, email, avatarUrl }: { displayName: string; email: string; avatarUrl: string | null }) {
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
    <form action={formAction} className="flex flex-col gap-5">
      <ProfilePicture name={displayName || email} src={avatarUrl} />

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
