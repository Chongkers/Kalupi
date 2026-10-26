import { Suspense } from "react";
import { NextLink } from "@/components/auth/next-link";
import { AuthNotice } from "./auth-notice";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <>
      <Suspense>
        <AuthNotice />
      </Suspense>

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Log in</h1>
        <p className="text-muted-foreground">Welcome back. Your tracker is waiting.</p>
      </div>

      <Suspense>
        <LoginForm />
      </Suspense>

      <p className="text-center text-sm text-muted-foreground">
        New to Kalupi?{" "}
        <Suspense>
          <NextLink href="/signup" className="font-medium text-primary underline underline-offset-4">
            Create an account
          </NextLink>
        </Suspense>
      </p>
    </>
  );
}
