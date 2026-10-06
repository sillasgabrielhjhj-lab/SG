"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import type { ProductCardData } from "@/features/catalog/types";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { ProductRail } from "@/components/commerce/product-rail";
import { SectionHeader } from "@/components/commerce/product-grid";
import { ProductCardSkeleton } from "@/components/commerce/product-card";

const MAX = 10;

/** "Vistos recentemente" (somente neste navegador, até 10 produtos). Some quando vazio. */
export function RecentlyViewed({ excludeId, title = "Vistos recentemente" }: { excludeId?: string; title?: string }) {
  const { ids, clear } = useRecentlyViewed();
  const [result, setResult] = useState<{ key: string; items: ProductCardData[] } | null>(null);
  const key = ids.filter((id) => id !== excludeId).slice(0, MAX).join(",");
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(`/api/products/by-ids?ids=${key}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: ProductCardData[] }) => setResult({ key, items: d.items }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [key]);
  if (!key) return null;
  const loading = !result;
  // Mantém a última lista até a nova chegar.
  const items = result?.items ?? [];
  if (!loading && !items.length) return null;
  return (
    <section data-reveal aria-labelledby="recent-title" aria-busy={loading || undefined}>
      <SectionHeader
        id="recent-title"
        title={title}
        icon={<History />}
        aside={
          <button type="button" onClick={clear} className="text-sm font-semibold text-fg-muted hover:text-fg hover:underline focus-ring">
            Limpar
          </button>
        }
      />
      {loading ? (
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:gap-3 sm:px-0">
          {Array.from({ length: Math.min(6, key.split(",").length) }, (_, i) => (
            <div key={i} className="w-[44%] shrink-0 py-1.5 sm:w-[31%] md:w-[23.5%] lg:w-[18.8%] xl:w-[15.8%]">
              <ProductCardSkeleton variant="compact" />
            </div>
          ))}
        </div>
      ) : (
        <ProductRail products={items} label={title} />
      )}
    </section>
  );
}

/** Registra a visualização do produto no histórico local. */
export function TrackRecentlyViewed({ productId }: { productId: string }) {
  const { add } = useRecentlyViewed();
  useEffect(() => add(productId), [productId, add]);
  return null;
}
