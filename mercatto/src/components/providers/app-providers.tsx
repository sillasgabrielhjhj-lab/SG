"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { CartIndicatorProvider } from "@/components/providers/cart-indicator";
import { AnalyticsListener } from "@/components/providers/analytics-listener";

export function AppProviders({ cartCount, children }: { cartCount: number; children: ReactNode }) {
  return (
    <ToastProvider>
      <CartIndicatorProvider initialCount={cartCount}>{children}</CartIndicatorProvider>
      <AnalyticsListener />
    </ToastProvider>
  );
}
