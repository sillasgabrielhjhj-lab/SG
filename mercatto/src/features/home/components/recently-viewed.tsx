"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import type { ProductCardData } from "@/features/catalog/types";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { ProductRail } from "@/components/commerce/product-rail";
import { SectionHeader } from "@/components/commerce/product-grid";

/** "Vistos recentemente" (somente neste navegador). Some quando vazio. */
export function RecentlyViewed({ excludeId, title = "Vistos recentemente" }: { excludeId?: string; title?: string }) {
  const { ids, clear } = useRecentlyViewed();
  const [items, setItems] = useState<ProductCardData[]>([]);
  const key = ids.filter((id) => id !== excludeId).slice(0, 12).join(",");
  useEffect(() => {
    if (!key) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/products/by-ids?ids=${key}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: ProductCardData[] }) => setItems(d.items))
      .catch(() => undefined);
    return () => controller.abort();
  }, [key]);
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent-title" className="animate-fade-in">
      <SectionHeader id="recent-title" title={title} icon={<History />} aside={<button type="button" onClick={clear} className="text-sm font-semibold text-fg-muted hover:text-fg hover:underline">Limpar</button>} />
      <ProductRail products={items} label={title} />
    </section>
  );
}

/** Registra a visualização do produto no histórico local. */
export function TrackRecentlyViewed({ productId }: { productId: string }) {
  const { add } = useRecentlyViewed();
  useEffect(() => add(productId), [productId, add]);
  return null;
}
