"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import type { FaqGroup } from "@/features/help/faq";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Central de ajuda com busca instantânea (sem acentos/maiúsculas) e atalhos por tema. */
export function HelpCenter({ groups }: { groups: FaqGroup[] }) {
  const [query, setQuery] = useState("");
  const q = normalize(useDeferredValue(query).trim());
  const visible = q
    ? groups.map((g) => ({ ...g, items: g.items.filter((i) => normalize(`${i.q} ${i.a}`).includes(q)) })).filter((g) => g.items.length)
    : groups;
  return (
    <>
      <label className="relative mt-5 block">
        <span className="sr-only">Como podemos ajudar?</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-subtle" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Como podemos ajudar?"
          className="h-12 w-full rounded-full border border-line-strong bg-surface pr-4 pl-12 text-base shadow-sm transition-[border-color,box-shadow] duration-(--motion-fast) outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
        />
      </label>
      {!q ? (
        <nav aria-label="Temas" className="mt-4 flex flex-wrap gap-2">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="press rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-fg-muted hover:border-brand-300 hover:text-brand-800 focus-ring">
              {g.title}
            </a>
          ))}
        </nav>
      ) : null}
      <div className="mt-6 flex flex-col gap-6" aria-live="polite">
        {visible.map((g) => (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`} className="scroll-mt-32">
            <h2 id={`${g.id}-title`} className="mb-2 text-lg font-bold">
              {g.title}
            </h2>
            <Accordion
              items={g.items.map((item, i) => ({
                id: `${g.id}-${i}`,
                title: item.q,
                content: (
                  <div className="text-sm leading-relaxed text-fg-muted">
                    {item.a}
                    {item.link ? (
                      <>
                        {" "}
                        <Link href={item.link.href} className="font-semibold text-brand-700 underline">
                          {item.link.label}
                        </Link>
                      </>
                    ) : null}
                  </div>
                ),
              }))}
            />
          </section>
        ))}
        {!visible.length ? (
          <p className="flex items-center gap-2 rounded-card bg-surface-muted p-4 text-sm text-fg-muted">
            <SearchX className="size-5 shrink-0" aria-hidden /> Nenhuma resposta para “{query}”. Tente outras palavras ou <Link href="/contato" className="font-semibold text-brand-700 underline">fale com a gente</Link>.
          </p>
        ) : null}
      </div>
    </>
  );
}
