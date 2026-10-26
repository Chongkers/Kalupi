import {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  Coins,
  CupSoda,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  type LucideIcon,
  Music,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  Utensils,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import {
  ACCOUNT_STYLES,
  categoryStyle,
  type CategoryColor,
  type CategoryIconKey,
} from "@/lib/finance/category-style";
import type { AccountKind, CategoryKind } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const ICONS: Record<CategoryIconKey | "banknote" | "landmark", LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  "cup-soda": CupSoda,
  "shopping-cart": ShoppingCart,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  plane: Plane,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  house: House,
  "heart-pulse": HeartPulse,
  pill: Pill,
  dumbbell: Dumbbell,
  "shopping-bag": ShoppingBag,
  shirt: Shirt,
  gift: Gift,
  clapperboard: Clapperboard,
  gamepad: Gamepad2,
  music: Music,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  baby: Baby,
  "paw-print": PawPrint,
  receipt: Receipt,
  briefcase: Briefcase,
  laptop: Laptop,
  coins: Coins,
  "hand-coins": HandCoins,
  "piggy-bank": PiggyBank,
  wallet: Wallet,
  tag: Tag,
  ellipsis: Ellipsis,
  banknote: Banknote,
  landmark: Landmark,
};

// Written out in full so Tailwind sees every class
export const COLOR_CLASSES: Record<CategoryColor, { chip: string; swatch: string }> = {
  blue: { chip: "bg-cat-blue/15 text-cat-blue", swatch: "bg-cat-blue" },
  orange: { chip: "bg-cat-orange/15 text-cat-orange", swatch: "bg-cat-orange" },
  aqua: { chip: "bg-cat-aqua/15 text-cat-aqua", swatch: "bg-cat-aqua" },
  yellow: { chip: "bg-cat-yellow/15 text-cat-yellow", swatch: "bg-cat-yellow" },
  magenta: { chip: "bg-cat-magenta/15 text-cat-magenta", swatch: "bg-cat-magenta" },
  green: { chip: "bg-cat-green/15 text-cat-green", swatch: "bg-cat-green" },
  violet: { chip: "bg-cat-violet/15 text-cat-violet", swatch: "bg-cat-violet" },
  red: { chip: "bg-cat-red/15 text-cat-red", swatch: "bg-cat-red" },
};

const SIZES = {
  xs: { box: "size-5 rounded-md", icon: "size-3" },
  sm: { box: "size-8 rounded-lg", icon: "size-4" },
  md: { box: "size-10 rounded-xl", icon: "size-5" },
};

type Size = keyof typeof SIZES;

/** A tinted rounded square with an icon. Always shown next to a name, so color is never the only cue. */
export function IconChip({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: keyof typeof ICONS;
  color: CategoryColor;
  size?: Size;
  className?: string;
}) {
  const Icon = ICONS[icon];
  return (
    <span className={cn("flex shrink-0 items-center justify-center", SIZES[size].box, COLOR_CLASSES[color].chip, className)}>
      <Icon className={SIZES[size].icon} aria-hidden />
    </span>
  );
}

export function CategoryIcon({
  category,
  size,
  className,
}: {
  category: { name: string; kind?: CategoryKind; icon?: string | null; color?: string | null };
  size?: Size;
  className?: string;
}) {
  const style = categoryStyle(category);
  return <IconChip icon={style.icon} color={style.color} size={size} className={className} />;
}

export function AccountIcon({ kind, size, className }: { kind: AccountKind; size?: Size; className?: string }) {
  const style = ACCOUNT_STYLES[kind];
  return <IconChip icon={style.icon} color={style.color} size={size} className={className} />;
}
