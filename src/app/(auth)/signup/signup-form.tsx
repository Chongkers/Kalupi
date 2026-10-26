"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { inputClass, labelClass, submitClass } from "@/components/form-styles";
import { NextField } from "@/components/auth/next-link";
import { signup, type SignupState } from "./actions";

const initialState: SignupState = {};

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, initialState);

  if (state.sentTo) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-mint p-4 text-mint-foreground">
        <MailCheck className="mt-0.5 size-5 shrink-0" />
        <p className="text-sm">
          We sent a confirmation link to <strong>{state.sentTo}</strong>. Open it on this device to finish
          signing up.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <NextField />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="displayName" className={labelClass}>
            Display name
          </FieldLabel>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="nickname"
            placeholder="What your friends call you"
            defaultValue={state.displayName}
            required
            className={inputClass}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email" className={labelClass}>
            Email
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={state.email}
            required
            className={inputClass}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password" className={labelClass}>
            Password
          </FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={inputClass}
          />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>

        <FieldError>{state.error}</FieldError>

        <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
          {isPending ? "Creating account…" : "Create account"}
        </Button>
      </FieldGroup>
    </form>
  );
}
