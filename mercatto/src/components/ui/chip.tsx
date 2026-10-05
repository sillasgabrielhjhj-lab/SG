import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chip de filtro aplicado (link que remove o filtro). */
export function FilterChip({ label, href, className }: { label: string; href: string; className?: string }) {
  return (
    <Link href={href} scroll={false} className={cn("inline-flex h-8 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 pr-2 pl-3 text-xs font-semibold text-brand-800 transition-colors hover:border-brand-400 hover:bg-brand-100 focus-ring", className)} aria-label={`Remover filtro ${label}`}>
      {label}
      <X className="size-3.5" aria-hidden />
    </Link>
  );
}
