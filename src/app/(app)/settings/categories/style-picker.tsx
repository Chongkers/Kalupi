"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon, COLOR_CLASSES, ICONS } from "@/components/finance/category-icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CATEGORY_COLORS, CATEGORY_ICONS, categoryStyle } from "@/lib/finance/category-style";
import type { Category } from "@/lib/finance/types";
import { setCategoryStyle } from "@/lib/local/mutations";
import { cn } from "@/lib/utils";

/** The category's icon; tap it to pick another icon and color. */
export function StylePicker({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const current = categoryStyle(category);
  const custom = !!(category.icon || category.color);

  const save = (icon: string | null, color: string | null) =>
    startTransition(async () => {
      const result = await setCategoryStyle(category.id, icon, color);
      if (result.error) toast.error(result.error);
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Change icon for ${category.name}`}
          className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={isPending}
        >
          <CategoryIcon category={category} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-3">
        <div className="flex items-center gap-3">
          <CategoryIcon category={category} />
          <span className="min-w-0 flex-1 truncate font-semibold">{category.name}</span>
          {custom && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => save(null, null)}>
              <RotateCcw /> Auto
            </Button>
          )}
        </div>

        <div role="radiogroup" aria-label="Color" className="flex justify-between">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={current.color === color}
              aria-label={color}
              title={color}
              onClick={() => save(category.icon ?? current.icon, color)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-popover aria-checked:ring-2 aria-checked:ring-foreground",
                COLOR_CLASSES[color].swatch,
              )}
            >
              {current.color === color && <Check className="size-4" />}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Icon" className="grid grid-cols-7 gap-1">
          {CATEGORY_ICONS.map((icon) => {
            const Icon = ICONS[icon];
            return (
              <button
                key={icon}
                type="button"
                role="radio"
                aria-checked={current.icon === icon}
                aria-label={icon.replace(/-/g, " ")}
                title={icon.replace(/-/g, " ")}
                onClick={() => save(icon, category.color ?? current.color)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent",
                  current.icon === icon && COLOR_CLASSES[current.color].chip,
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
