"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { ProductCardData } from "@/features/catalog/types";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { useSearchHistory } from "@/hooks/use-search-history";
import { ProductRail } from "@/components/commerce/product-rail";
import { SectionHeader } from "@/components/commerce/product-grid";

/**
 * "Recomendados para você". Começa com a seleção do servidor (populares que
 * não aparecem em outras seções — boa para SEO e sem salto de layout) e, se o
 * navegador tiver sinais (vistos, buscas), troca pela versão personalizada.
 */
export function RecommendedForYou({ initial, exclude, favorites }: { initial: ProductCardData[]; exclude: string[]; favorites: string[] }) {
  const { ids } = useRecentlyViewed();
  const { history } = useSearchHistory();
  const [result, setResult] = useState<{ key: string; items: ProductCardData[]; personalized: boolean } | null>(null);
  const viewed = ids.slice(0, 10);
  const terms = history.slice(0, 3);
  const key = viewed.length || terms.length ? `${viewed.join(",")}|${terms.join("|")}` : "";
  const excludeKey = exclude.slice(0, 80).join(",");

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const sep = key.indexOf("|");
    const params = new URLSearchParams({ viewed: key.slice(0, sep), exclude: excludeKey });
    for (const t of key.slice(sep + 1).split("|").filter(Boolean)) params.append("q", t);
    fetch(`/api/recommendations?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items: ProductCardData[]; personalized: boolean } | null) => {
        if (d) setResult({ key, items: d.items, personalized: d.personalized });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [key, excludeKey]);

  const live = result?.key === key && result.items.length >= 2 ? result : null;
  const items = live?.items ?? initial;
  if (items.length < 2) return null;
  return (
    <section data-reveal aria-labelledby="rec-title">
      <SectionHeader id="rec-title" title="Recomendados para você" subtitle={live?.personalized ? "Com base no que você viu e buscou" : "Seleção em alta na Mercatto"} icon={<Sparkles />} />
      <ProductRail products={items} label="Recomendados para você" favorites={favorites} />
    </section>
  );
}
