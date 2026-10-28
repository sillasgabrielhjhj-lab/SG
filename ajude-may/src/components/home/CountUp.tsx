"use client";

import { useEffect, useRef, useState } from "react";
import { formatBRL } from "@/lib/money";

/**
 * Conta de R$ 0 até o valor quando aparece na tela. É só um efeito de apresentação: o HTML já
 * traz o valor real (que leitores de tela leem direto) e, com "reduzir movimento", não há animação.
 */
export function CountUp({ cents, className }: { cents: number; className?: string }) {
  const [shown, setShown] = useState(cents);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        let start: number | undefined;
        const tick = (now: number) => {
          start ??= now;
          const t = Math.min((now - start) / 1600, 1);
          const eased = 1 - (1 - t) ** 3;
          setShown(t < 1 ? Math.round((cents * eased) / 100) * 100 : cents);
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [cents]);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{formatBRL(cents)}</span>
      <span aria-hidden>{formatBRL(shown)}</span>
    </span>
  );
}
