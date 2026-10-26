"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { inputClass, labelClass, submitClass } from "@/components/form-styles";
import { updatePassword, type ResetState } from "./actions";

const initialState: ResetState = {};

export function ResetForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password" className={labelClass}>
            New password
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
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm" className={labelClass}>
            Confirm new password
          </FieldLabel>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={inputClass}
          />
        </Field>

        <FieldError>{state.error}</FieldError>

        <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
          {isPending ? "Saving…" : "Save new password"}
        </Button>
      </FieldGroup>
    </form>
  );
}
