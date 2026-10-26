"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { inputClass, labelClass, submitClass } from "@/components/form-styles";
import { NextField } from "@/components/auth/next-link";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction}>
      <NextField />
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
            defaultValue={state.email}
            aria-invalid={!!state.error}
            required
            className={inputClass}
          />
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password" className={labelClass}>
              Password
            </FieldLabel>
            <Link href="/forgot-password" className="text-sm font-medium text-primary underline underline-offset-4">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!state.error}
            required
            className={inputClass}
          />
        </Field>

        <FieldError>{state.error}</FieldError>

        <Button type="submit" size="lg" disabled={isPending} className={submitClass}>
          {isPending ? "Logging in…" : "Log in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
