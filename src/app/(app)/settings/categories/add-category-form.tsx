"use client";

import { useActionState, useRef } from "react";
import { Plus } from "lucide-react";
import { inputClass, selectClass } from "@/components/form-styles";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CategoryKind } from "@/lib/finance/types";
import type { ManageState } from "../manage-row";
import { addCategory } from "@/lib/local/mutations";

export function AddCategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(async (_prev: ManageState, formData: FormData) => {
    const result = await addCategory(String(formData.get("name") ?? ""), String(formData.get("kind") ?? "") as CategoryKind);
    if (!result.error) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
        <Input name="name" aria-label="Category name" placeholder="e.g. Groceries" required maxLength={40} className={inputClass} />
        <NativeSelect name="kind" aria-label="Category type" defaultValue="expense" className="w-full" selectClassName={selectClass}>
          <NativeSelectOption value="expense">Expense</NativeSelectOption>
          <NativeSelectOption value="income">Income</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" size="lg" disabled={isPending} className="h-11">
          <Plus /> Add
        </Button>
      </div>
      <FieldError>{state.error}</FieldError>
    </form>
  );
}
