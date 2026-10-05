"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Header fixo com sombra ao rolar (sem layout shift). */
export function StickyHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <header className={cn("sticky top-0 z-40 bg-brand-800 transition-shadow duration-200", scrolled && "shadow-[0_6px_20px_-8px_oklch(0.2_0.05_180/0.45)]")}>{children}</header>;
}
