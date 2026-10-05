"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ProductImage } from "@/components/commerce/product-image";
import { adminSearchProductsAction, sellerSearchProductsAction } from "@/features/marketing/actions";
import type { MarketingMode } from "@/features/marketing/components/marketing-ui";

export type PickedProduct = { id: string; name: string; sku: string; imageUrl: string | null; minPriceCents: number; storeName?: string | null; status?: string };
export type CategoryOption = { id: string; name: string; depth: number; path: string };

const PRODUCT_STATUS: Record<string, string> = { DRAFT: "Rascunho", PAUSED: "Pausado", OUT_OF_STOCK: "Sem estoque", ARCHIVED: "Arquivado" };

type SearchRow = { id: string; name: string; sku: string; minPriceCents: number; status: string; store: { name: string }; images: { url: string }[] };
const toPicked = (p: SearchRow): PickedProduct => ({ id: p.id, name: p.name, sku: p.sku, imageUrl: p.images[0]?.url ?? null, minPriceCents: p.minPriceCents, storeName: p.store.name, status: p.status });

/**
 * Seleção de produtos com busca (debounce) pela action do modo — o servidor
 * restringe o escopo (vendedor só vê a própria loja).
 */
export function ProductPicker({ mode, value, onChange, disabled, label, hint, error, max = 500 }: { mode: MarketingMode; value: PickedProduct[]; onChange: (next: PickedProduct[]) => void; disabled?: boolean; label: string; hint?: string; error?: string; max?: number }) {
  const toast = useToast();
  const inputId = useId();
  const listId = useId();
  const hintId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PickedProduct[] | null>(null);
  const [active, setActive] = useState(-1);
  const timer = useRef<number | undefined>(undefined);
  const reqId = useRef(0);
  const selected = useMemo(() => new Set(value.map((p) => p.id)), [value]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const search = (term: string, delay = 300) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const id = ++reqId.current;
      setLoading(true);
      const res = mode === "seller" ? await sellerSearchProductsAction({ q: term }) : await adminSearchProductsAction({ q: term });
      if (id !== reqId.current) return;
      setLoading(false);
      if (res.ok) {
        setResults(res.data.map(toPicked));
        setActive(-1);
      } else toast.error(res.error);
    }, delay);
  };

  const toggle = (p: PickedProduct) => {
    if (selected.has(p.id)) onChange(value.filter((x) => x.id !== p.id));
    else if (value.length >= max) toast.error(`Limite de ${max} produtos por promoção.`);
    else onChange([...value, p]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = results ?? [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => (list.length ? (i + 1) % list.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (list.length ? (i - 1 + list.length) % list.length : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = list[active];
      if (open && item) toggle(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const describedBy = [hint && !error ? hintId : null, error ? `${hintId}-e` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
        <input
          id={inputId}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 && results?.[active] ? `${listId}-${results[active]!.id}` : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          value={q}
          placeholder="Buscar por nome ou SKU"
          maxLength={80}
          onFocus={() => {
            setOpen(true);
            if (results === null) search(q, 0);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            search(e.target.value);
          }}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-field border border-line-strong bg-surface pr-10 pl-9 text-sm text-fg placeholder:text-fg-subtle hover:border-fg-subtle focus:border-brand-600 focus:shadow-focus focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted aria-[invalid=true]:border-danger-600"
        />
        {loading ? <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-brand-700" label="Buscando produtos" /> : null}
        {open ? (
          <ul id={listId} role="listbox" aria-label="Resultados da busca" aria-multiselectable="true" className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-popover">
            {results === null ? (
              <li className="px-3 py-4 text-center text-sm text-fg-muted">Buscando…</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-fg-muted">Nenhum produto encontrado.</li>
            ) : (
              results.map((p, i) => {
                const isSel = selected.has(p.id);
                return (
                  <li
                    key={p.id}
                    id={`${listId}-${p.id}`}
                    role="option"
                    aria-selected={isSel}
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(p)}
                    onMouseEnter={() => setActive(i)}
                    className={cn("flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm", i === active ? "bg-brand-50" : "hover:bg-surface-muted")}
                  >
                    <span className="relative size-10 shrink-0 overflow-hidden rounded border border-line bg-white">
                      <ProductImage src={p.imageUrl} alt="" sizes="40px" className="[&_svg]:size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 font-medium">{p.name}</span>
                      <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
                        <span className="font-mono">{p.sku}</span>
                        <span>· {formatBRL(p.minPriceCents)}</span>
                        {mode === "admin" && p.storeName ? <span>· {p.storeName}</span> : null}
                        {p.status && PRODUCT_STATUS[p.status] ? <span className="font-semibold text-warning-700">· {PRODUCT_STATUS[p.status]}</span> : null}
                      </span>
                    </span>
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border", isSel ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong text-transparent")} aria-hidden>
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${hintId}-e`} role="alert" className="text-xs font-medium text-danger-700">
          {error}
        </p>
      ) : null}

      {value.length ? (
        <div className="mt-1">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-fg-muted">
            <span aria-live="polite">{value.length} produto(s) selecionado(s)</span>
            {!disabled && value.length > 1 ? (
              <button type="button" onClick={() => onChange([])} className="font-semibold text-danger-700 hover:underline focus-ring">
                Remover todos
              </button>
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-2">
            {value.map((p) => (
              <li key={p.id} className="flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-muted py-1 pr-1 pl-1 text-sm">
                <span className="relative size-7 shrink-0 overflow-hidden rounded-full border border-line bg-white">
                  <ProductImage src={p.imageUrl} alt="" sizes="28px" className="[&_svg]:size-3" />
                </span>
                <span className="max-w-56 min-w-0 truncate font-medium" title={p.name}>
                  {p.name}
                </span>
                <span className="shrink-0 text-xs text-fg-muted tabular">{formatBRL(p.minPriceCents)}</span>
                {!disabled ? (
                  <button type="button" onClick={() => onChange(value.filter((x) => x.id !== p.id))} className="grid size-7 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-line hover:text-fg focus-ring" aria-label={`Remover ${p.name}`}>
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Seleção múltipla de categorias (lista filtrável em árvore + chips). */
export function CategoryMultiSelect({ options, value, onChange, disabled, label, hint, error }: { options: CategoryOption[]; value: string[]; onChange: (next: string[]) => void; disabled?: boolean; label: string; hint?: string; error?: string }) {
  const [filter, setFilter] = useState("");
  const filterId = useId();
  const groupId = useId();
  const byId = useMemo(() => new Map(options.map((c) => [c.id, c])), [options]);
  const term = filter.trim().toLowerCase();
  const visible = term ? options.filter((c) => c.path.toLowerCase().includes(term)) : options;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" disabled={disabled} aria-describedby={hint || error ? `${groupId}-d` : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-fg">{label}</legend>
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Categorias selecionadas">
          {value.map((id) => {
            const c = byId.get(id);
            return (
              <li key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-0.5 pr-1 pl-2.5 text-sm font-medium text-brand-900">
                <span className="truncate">{c ? c.path : "Categoria inativa"}</span>
                {!disabled ? (
                  <button type="button" onClick={() => toggle(id)} className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-brand-100 focus-ring" aria-label={`Remover ${c?.name ?? "categoria"}`}>
                    <X className="size-3" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="rounded-field border border-line-strong bg-surface">
        <label htmlFor={filterId} className="sr-only">
          Filtrar categorias
        </label>
        <div className="relative border-b border-line">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input id={filterId} type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar categorias" className="h-10 w-full rounded-t-field bg-transparent pr-3 pl-9 text-sm outline-none focus-visible:shadow-focus disabled:cursor-not-allowed" />
        </div>
        <ul className="max-h-56 overflow-y-auto p-1">
          {visible.length === 0 ? <li className="px-3 py-3 text-sm text-fg-muted">Nenhuma categoria encontrada.</li> : null}
          {visible.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-surface-muted has-disabled:cursor-not-allowed" style={term ? undefined : { paddingLeft: `${0.5 + c.depth * 1.1}rem` }}>
                <input type="checkbox" checked={value.includes(c.id)} onChange={() => toggle(c.id)} className="size-4 shrink-0 accent-brand-700" />
                <span className={cn("min-w-0 truncate", c.depth === 0 && !term && "font-semibold")}>{term ? c.path : c.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      {hint && !error ? (
        <p id={`${groupId}-d`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${groupId}-d`} role="alert" className="text-xs font-medium text-danger-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
