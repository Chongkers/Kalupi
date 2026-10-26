import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">Forgot password</h1>
        <p className="text-muted-foreground">We&apos;ll email you a link to set a new one.</p>
      </div>

      <ForgotForm />

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
