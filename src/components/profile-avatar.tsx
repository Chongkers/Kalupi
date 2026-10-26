import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** Someone's picture, or their initials when there isn't one (or it can't load offline). */
export function ProfileAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className="bg-lavender font-semibold text-[#1c1838]">{initials || "?"}</AvatarFallback>
    </Avatar>
  );
}
