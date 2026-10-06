"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Um único listener (delegação) para cliques em cards de produto: qualquer
 * link com `data-analytics-item` gera `select_item` (product_click) — sem
 * transformar os cards (Server Components) em componentes de cliente.
 */
export function AnalyticsListener() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.<HTMLElement>("[data-analytics-item]");
      if (!link) return;
      trackEvent("select_item", { item_id: link.dataset.analyticsItem, item_list_name: link.dataset.analyticsList ?? null });
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
