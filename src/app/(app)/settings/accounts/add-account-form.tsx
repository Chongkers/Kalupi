"use client";

import { useActionState, useRef } from "react";
import { Plus } from "lucide-react";
import { inputClass, selectClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ACCOUNT_KIND_LABELS, type AccountKind } from "@/lib/finance/types";
import type { ManageState } from "../manage-row";
import { addAccount } from "@/lib/local/mutations";

export function AddAccountForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(async (_prev: ManageState, formData: FormData) => {
    const result = await addAccount(String(formData.get("name") ?? ""), String(formData.get("kind") ?? "") as AccountKind, String(formData.get("balance") ?? ""));
    if (!result.error) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_10rem_auto]">
        <Input name="name" aria-label="Account name" placeholder="e.g. Maya, GCash" required maxLength={40} className={inputClass} />
        <NativeSelect name="kind" aria-label="Account type" defaultValue="ewallet" className="w-full" selectClassName={selectClass}>
          {Object.entries(ACCOUNT_KIND_LABELS).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input name="balance" aria-label="Starting balance" inputMode="decimal" placeholder="₱ Starting balance" className={inputClass} />
        <Button type="submit" size="lg" disabled={isPending} className="h-11">
          <Plus /> Add
        </Button>
      </div>
      <FieldError>{state.error}</FieldError>
    </form>
  );
}
