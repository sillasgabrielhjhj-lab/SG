import Link from "next/link";
import { cn } from "@/lib/utils";

/** Abas de filtro como links (estado na URL). `href` é montado no servidor. */
export function FilterTabs({ items, label, className }: { items: { label: string; href: string; active: boolean; count?: number }[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0", className)}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap focus-ring", t.active ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-line bg-surface text-fg-muted hover:border-brand-300")}>
          {t.label}
          {t.count ? <span className="rounded-full bg-surface-muted px-1.5 text-2xs font-bold">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Monta href preservando parâmetros (remove vazios e página 1). */
export function buildHref(base: string, params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "pagina" && Number(v) <= 1) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
