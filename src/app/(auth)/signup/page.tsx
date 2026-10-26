import { Suspense } from "react";
import { NextLink } from "@/components/auth/next-link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Create an account</h1>
        <p className="text-muted-foreground">Start tracking your money in a minute.</p>
      </div>

      <Suspense>
        <SignupForm />
      </Suspense>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Suspense>
          <NextLink href="/login" className="font-medium text-primary underline underline-offset-4">
            Log in
          </NextLink>
        </Suspense>
      </p>
    </>
  );
}
