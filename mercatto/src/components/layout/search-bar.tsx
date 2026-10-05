"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpLeft, History, Search, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearchHistory } from "@/hooks/use-search-history";

type Suggestions = {
  terms: string[];
  categories: { name: string; slug: string }[];
  products: { id: string; name: string; slug: string; imageUrl: string | null; priceCents: number }[];
};

type Option = { key: string; kind: "history" | "term" | "category" | "product"; label: string; href: string; extra?: string; imageUrl?: string | null };

/**
 * Busca com autocomplete (combobox WAI-ARIA): histórico local, termos
 * populares, categorias e produtos. Teclado: ↑ ↓ Enter Esc.
 */
export function SearchBar({ defaultValue = "", className, autoFocus, onNavigate, variant = "header" }: { defaultValue?: string; className?: string; autoFocus?: boolean; onNavigate?: () => void; variant?: "header" | "page" }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [data, setData] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const query = useDebounce(value.trim(), 180);
  const { history, add, remove, clear } = useSearchHistory();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(defaultValue), [defaultValue]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Suggestions | null) => setData(d))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = useMemo<Option[]>(() => {
    const list: Option[] = [];
    if (!query) {
      history.slice(0, 5).forEach((h) => list.push({ key: `h:${h}`, kind: "history", label: h, href: `/buscar?q=${encodeURIComponent(h)}` }));
      data?.terms.slice(0, 6).forEach((t) => list.push({ key: `t:${t}`, kind: "term", label: t, href: `/buscar?q=${encodeURIComponent(t)}` }));
      return list;
    }
    data?.terms.slice(0, 4).forEach((t) => list.push({ key: `t:${t}`, kind: "term", label: t, href: `/buscar?q=${encodeURIComponent(t)}` }));
    data?.categories.forEach((c) => list.push({ key: `c:${c.slug}`, kind: "category", label: c.name, href: `/categoria/${c.slug}`, extra: "Categoria" }));
    data?.products.forEach((p) => list.push({ key: `p:${p.id}`, kind: "product", label: p.name, href: `/produto/${p.slug}`, extra: formatBRL(p.priceCents), imageUrl: p.imageUrl }));
    return list;
  }, [query, data, history]);

  const go = (href: string, term?: string) => {
    if (term) add(term);
    setOpen(false);
    setActive(-1);
    onNavigate?.();
    router.push(href);
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const opt = options[active];
    if (opt) return go(opt.href, opt.kind === "product" || opt.kind === "category" ? undefined : opt.label);
    const q = value.trim();
    if (!q) return;
    go(`/buscar?q=${encodeURIComponent(q)}`, q);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const showPanel = open && (options.length > 0 || (query.length >= 2 && !loading));

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <form role="search" onSubmit={submit} className="relative">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Buscar produtos, marcas e muito mais
        </label>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
          value={value}
          maxLength={80}
          placeholder="Buscar produtos, marcas e muito mais…"
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-11 w-full rounded-field border bg-white pr-20 pl-4 text-[15px] text-fg shadow-sm placeholder:text-fg-subtle focus:outline-none [&::-webkit-search-cancel-button]:hidden",
            variant === "header" ? "border-transparent focus:shadow-[0_0_0_3px_oklch(0.875_0.15_80/0.6)]" : "border-line-strong focus:border-brand-600 focus:shadow-focus",
          )}
        />
        {value ? (
          <button type="button" onClick={() => (setValue(""), inputRef.current?.focus())} className="absolute top-1/2 right-12 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-subtle hover:bg-surface-muted hover:text-fg focus-ring" aria-label="Limpar busca">
            <X className="size-4" />
          </button>
        ) : null}
        <button type="submit" className="absolute top-1 right-1 grid h-9 w-10 place-items-center rounded-[8px] bg-brand-700 text-white transition-colors hover:bg-brand-800 focus-ring" aria-label="Buscar">
          <Search className="size-[18px]" />
        </button>
      </form>

      {showPanel ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[70dvh] origin-top animate-scale-in overflow-y-auto rounded-card border border-line bg-surface py-1.5 text-fg shadow-popover">
          {!query && history.length > 0 ? (
            <div className="flex items-center justify-between px-4 pt-1.5 pb-1 text-xs font-semibold text-fg-subtle">
              <span>Buscas recentes</span>
              <button type="button" onClick={clear} className="font-semibold text-brand-700 hover:underline focus-ring">
                Limpar
              </button>
            </div>
          ) : null}
          <ul id={listId} role="listbox" aria-label="Sugestões de busca">
            {options.map((opt, i) => (
              <li
                key={opt.key}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                className={cn("group flex cursor-pointer items-center gap-3 px-4 py-2 text-sm", i === active && "bg-brand-50")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(opt.href, opt.kind === "product" || opt.kind === "category" ? undefined : opt.label)}
              >
                {opt.kind === "product" ? (
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-md border border-line bg-white">
                    {opt.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniaturas pequenas (SVG demo / CDN)
                      <img src={opt.imageUrl} alt="" className="size-full object-contain p-0.5" loading="lazy" />
                    ) : null}
                  </span>
                ) : opt.kind === "history" ? (
                  <History className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                ) : opt.kind === "category" ? (
                  <span className="grid size-4 shrink-0 place-items-center text-brand-700">
                    <Search className="size-4" aria-hidden />
                  </span>
                ) : (
                  <TrendingUp className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {opt.label}
                  {opt.kind === "category" ? <span className="ml-1.5 text-xs text-fg-subtle">em categorias</span> : null}
                </span>
                {opt.kind === "product" ? <span className="shrink-0 text-sm font-semibold tabular">{opt.extra}</span> : null}
                {opt.kind === "history" ? (
                  <button
                    type="button"
                    aria-label={`Remover "${opt.label}" do histórico`}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(opt.label);
                    }}
                    className="grid size-7 place-items-center rounded-full text-fg-subtle opacity-70 hover:bg-surface-muted hover:text-fg focus-ring"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : opt.kind === "term" ? (
                  <ArrowUpLeft className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                ) : null}
              </li>
            ))}
          </ul>
          {query.length >= 2 && options.length === 0 && !loading ? <p className="px-4 py-3 text-sm text-fg-muted">Nenhuma sugestão. Pressione Enter para buscar “{query}”.</p> : null}
          {query.length >= 2 ? (
            <Link href={`/buscar?q=${encodeURIComponent(query)}`} onClick={() => (add(query), setOpen(false), onNavigate?.())} className="mx-1.5 mt-1 flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-ring">
              <Search className="size-4" aria-hidden />
              Ver todos os resultados para “{query}”
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
