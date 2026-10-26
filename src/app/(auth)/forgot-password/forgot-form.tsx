"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { inputClass, labelClass, submitClass } from "@/components/form-styles";
import { sendResetLink, type ForgotState } from "./actions";

const initialState: ForgotState = {};

export function ForgotForm() {
  const [state, formAction, isPending] = useActionState(sendResetLink, initialState);

  if (state.sentTo) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-mint p-4 text-mint-foreground">
        <MailCheck className="mt-0.5 size-5 shrink-0" />
        <p className="text-sm">
          If <strong>{state.sentTo}</strong> has a Kalupi account, a reset link is on its way. Open it on this
          device.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <FieldGroup>
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
            required
            className={inputClass}
          />
        </Field>

        <FieldError>{state.error}</FieldError>

        <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
          {isPending ? "Sending…" : "Send reset link"}
        </Button>
      </FieldGroup>
    </form>
  );
}
