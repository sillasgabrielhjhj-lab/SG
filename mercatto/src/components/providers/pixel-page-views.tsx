"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** PageView do Pixel nas navegações internas (a primeira já sai no carregamento do script). */
export function PixelPageViews() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== null && last.current !== pathname) window.fbq?.("track", "PageView");
    last.current = pathname;
  }, [pathname]);
  return null;
}
