/**
 * Presets de movimento para animações feitas em JS (Web Animations API).
 * Os presets de CSS ficam em globals.css (animate-fade-up, animate-enter,
 * hover-lift, press, data-reveal...). Somente transform/opacity.
 */
export const EASE_OUT_SOFT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_EMPHASIZED = "cubic-bezier(0.2, 0, 0, 1)";

export const DURATION = { fast: 150, base: 250, slow: 450, flight: 650 } as const;

/** Atraso de entrada escalonado (stagger) — 50ms por item, no máximo 8 itens. */
export function staggerDelay(index: number, stepMs = 50, max = 8): string {
  return `${Math.min(index, max) * stepMs}ms`;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
