import { cn } from "@/lib/utils";

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800", className)}>
      {initials || "?"}
    </span>
  );
}
