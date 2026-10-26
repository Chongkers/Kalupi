import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">Set a new password</h1>
        <p className="text-muted-foreground">You&apos;ll stay logged in on this device.</p>
      </div>

      <ResetForm />
    </>
  );
}
