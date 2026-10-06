import { DURATION, EASE_EMPHASIZED, prefersReducedMotion } from "@/lib/motion";

/** Ícone do carrinho visível agora (header no desktop, barra inferior no mobile). */
function visibleCartTarget(): HTMLElement | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"));
  return targets.find((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0) ?? null;
}

/**
 * Microinteração "produto → carrinho": uma miniatura da imagem do produto
 * voa até o ícone do carrinho (transform/opacity, ~650ms) e some.
 * Não bloqueia nada e é ignorada com movimento reduzido.
 */
export function flyToCart(source: Element | null): void {
  if (typeof window === "undefined" || !source || prefersReducedMotion()) return;
  const target = visibleCartTarget();
  if (!target) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width || !to.width) return;

  const size = Math.min(96, Math.max(48, from.width * 0.35));
  const startX = from.left + from.width / 2 - size / 2;
  const startY = from.top + from.height / 2 - size / 2;
  const dx = to.left + to.width / 2 - (startX + size / 2);
  const dy = to.top + to.height / 2 - (startY + size / 2);

  const ghost = document.createElement("div");
  const img = source instanceof HTMLImageElement ? source : source.querySelector("img");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "14px",
    background: img?.currentSrc ? `#fff center / contain no-repeat url("${img.currentSrc.replace(/"/g, "%22")}")` : "var(--color-brand-600)",
    boxShadow: "var(--shadow-popover)",
    zIndex: "var(--z-toast)",
    pointerEvents: "none",
    willChange: "transform, opacity",
  });
  ghost.setAttribute("aria-hidden", "true");
  document.body.appendChild(ghost);

  const animation = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 40}px) scale(0.7)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0.35 },
    ],
    { duration: DURATION.flight, easing: EASE_EMPHASIZED, fill: "forwards" },
  );
  const cleanup = () => ghost.remove();
  animation.onfinish = cleanup;
  animation.oncancel = cleanup;
}
