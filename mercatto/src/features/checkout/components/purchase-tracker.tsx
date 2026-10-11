"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/** Compra para analytics/anúncios — só na confirmação (pagamento aprovado), uma vez por checkout. */
export function PurchaseTracker({ checkoutId, value, numItems }: { checkoutId: string; value: number; numItems: number }) {
  useEffect(() => {
    const key = `mct:purchase:${checkoutId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* sem armazenamento: segue (o eventID evita duplicar no Meta) */
    }
    trackEvent("purchase", { transaction_id: checkoutId, value, num_items: numItems });
  }, [checkoutId, value, numItems]);
  return null;
}
