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
  return <header className={cn("sticky top-0 z-(--z-header) bg-brand-800 transition-[box-shadow,background-color] duration-300 ease-out-soft", scrolled && "bg-brand-800/[0.97] shadow-[0_10px_28px_-12px_oklch(0.2_0.05_180/0.55)] backdrop-blur-md")}>{children}</header>;
}
