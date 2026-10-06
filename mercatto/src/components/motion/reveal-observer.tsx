"use client";

import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Revelação ao rolar para qualquer elemento com `data-reveal` (inclusive de
 * Server Components — basta o atributo). Um único IntersectionObserver para a
 * página toda; cada elemento anima uma única vez.
 *
 * - O que já está visível ao carregar nunca é escondido (sem flash, LCP intacto).
 * - Sem JS (ou com movimento reduzido) o conteúdo simplesmente aparece.
 * - Seções renderizadas depois (vitrines no cliente) são detectadas via MutationObserver.
 *
 * Renderize como ÚLTIMO filho da página que usa `data-reveal`: o efeito só roda
 * depois que a página inteira hidratou (marcar antes gera divergência de hidratação).
 */
export function RevealObserver() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.removeAttribute("data-reveal-pending");
          el.setAttribute("data-revealed", "");
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );
    const scan = () => {
      const fold = window.innerHeight * 0.92;
      document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed]):not([data-reveal-pending])").forEach((el) => {
        if (el.getBoundingClientRect().top < fold) {
          el.setAttribute("data-revealed", "");
          return;
        }
        el.setAttribute("data-reveal-pending", "");
        io.observe(el);
      });
    };
    scan();
    let frame = 0;
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      io.disconnect();
      // Na troca de rota nada pode ficar escondido.
      document.querySelectorAll("[data-reveal-pending]").forEach((el) => el.removeAttribute("data-reveal-pending"));
    };
  }, []);
  return null;
}
