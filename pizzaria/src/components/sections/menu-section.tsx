'use client';

import { m } from 'framer-motion';
import { Search, SearchX, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { Button } from '@/components/ui/button';
import { Accent, SectionHeading } from '@/components/ui/section-heading';
import { categories } from '@/data/categories';
import { products } from '@/data/menu';
import { matchesSearch, tagLabels } from '@/lib/menu';
import { cn } from '@/lib/utils';
import type { CategoryId, ProductTag } from '@/types/menu';

const filterTags: ProductTag[] = ['mais-pedido', 'vegetariano', 'picante', 'novidade'];

export function MenuSection() {
  const [category, setCategory] = useState<CategoryId | 'todos'>('todos');
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<ProductTag[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const filtered = products.filter(
      (p) =>
        (category === 'todos' || p.category === category) &&
        matchesSearch(p, query) &&
        tags.every((t) => p.tags?.includes(t)),
    );
    return categories
      .map((c) => ({ category: c, items: filtered.filter((p) => p.category === c.id) }))
      .filter((g) => g.items.length > 0);
  }, [category, query, tags]);

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  const hasFilters = category !== 'todos' || query.trim() !== '' || tags.length > 0;

  const scrollToResults = () => {
    const el = resultsRef.current;
    if (!el) return;
    const offset = window.innerHeight * 0.25;
    if (el.getBoundingClientRect().top < offset) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const selectCategory = (id: CategoryId | 'todos') => {
    setCategory(id);
    requestAnimationFrame(scrollToResults);
  };

  const toggleTag = (tag: ProductTag) =>
    setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));

  const clearAll = () => {
    setCategory('todos');
    setQuery('');
    setTags([]);
  };

  return (
    <section id="cardapio" aria-labelledby="cardapio-title" className="bg-cream-50 pt-20 pb-24 lg:pt-28 lg:pb-32">
      <div className="container-page">
        <SectionHeading
          id="cardapio-title"
          eyebrow="Cardápio"
          title={
            <>
              Escolha, personalize <Accent>e peça.</Accent>
            </>
          }
          description="Pizzas em três tamanhos, meio a meio, bordas recheadas e adicionais. Tudo em poucos toques."
        />
      </div>

      {/* Barra fixa: busca + categorias */}
      <div className="sticky top-[var(--header-height)] z-30 mt-10 border-y border-ink-900/[0.06] bg-cream-50/92 backdrop-blur-xl">
        <div className="container-page flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="relative lg:w-80 lg:shrink-0">
            <label htmlFor="menu-search" className="sr-only">
              Buscar no cardápio
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              id="menu-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Buscar sabor ou ingrediente"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 w-full rounded-full border border-ink-900/10 bg-white pr-11 pl-11 text-[0.9375rem] text-ink-900 shadow-[var(--shadow-soft)] transition-colors outline-none placeholder:text-ink-400 focus:border-tomato-500 focus:ring-4 focus:ring-tomato-500/15"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-500 hover:bg-ink-900/[0.06]"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          <nav aria-label="Categorias do cardápio" className="-mx-4 min-w-0 lg:mx-0 lg:flex-1">
            <ul className="scrollbar-none flex gap-2 overflow-x-auto px-4 lg:px-0">
              {[{ id: 'todos' as const, name: 'Todos' }, ...categories].map((c) => {
                const active = category === c.id;
                return (
                  <li key={c.id} className="shrink-0">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectCategory(c.id)}
                      className={cn(
                        'h-10 rounded-full px-4 text-sm font-semibold transition-colors',
                        active
                          ? 'bg-ink-900 text-cream-50'
                          : 'bg-white text-ink-600 shadow-[var(--shadow-ring)] hover:bg-cream-100 hover:text-ink-900',
                      )}
                    >
                      {c.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      <div ref={resultsRef} className="container-page scroll-mt-[calc(var(--header-height)+8.5rem)] pt-8 lg:scroll-mt-[calc(var(--header-height)+5rem)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Filtros" className="flex flex-wrap gap-2">
            {filterTags.map((tag) => {
              const active = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors',
                    active
                      ? 'border-tomato-500 bg-tomato-50 text-tomato-700'
                      : 'border-ink-900/10 text-ink-600 hover:border-ink-900/25 hover:text-ink-900',
                  )}
                >
                  {active && <X className="size-3.5" aria-hidden />}
                  {tagLabels[tag]}
                </button>
              );
            })}
          </div>
          <p aria-live="polite" className="text-sm text-ink-500">
            {total} {total === 1 ? 'item' : 'itens'}
            {hasFilters && (
              <button type="button" onClick={clearAll} className="ml-3 font-semibold text-tomato-600 hover:underline">
                Limpar filtros
              </button>
            )}
          </p>
        </div>

        <m.div
          key={`${category}|${tags.join(',')}|${query.trim() === '' ? '' : 'q'}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {groups.length === 0 ? (
            <div className="mx-auto mt-16 flex max-w-md flex-col items-center text-center">
              <span className="inline-flex size-16 items-center justify-center rounded-full bg-cream-200 text-ink-400">
                <SearchX className="size-7" aria-hidden />
              </span>
              <h3 className="text-display mt-5 text-2xl">Nada encontrado</h3>
              <p className="mt-2 text-ink-500">
                Não achamos itens{query ? ` para “${query}”` : ''} com esses filtros. Tente outro sabor ou ingrediente.
              </p>
              <Button variant="dark" className="mt-6" onClick={clearAll}>
                Ver cardápio completo
              </Button>
            </div>
          ) : (
            groups.map(({ category: c, items }) => (
              <section key={c.id} aria-labelledby={`cat-${c.id}`} className="mt-12 first:mt-10">
                <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-ink-900/[0.07] pb-3">
                  <h3 id={`cat-${c.id}`} className="text-display text-2xl font-medium sm:text-3xl">
                    {c.name}
                  </h3>
                  <p className="hidden text-sm text-ink-500 sm:block">{c.description}</p>
                </div>
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((product) => (
                    <li key={product.id}>
                      <MenuItemCard product={product} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </m.div>
      </div>
    </section>
  );
}
