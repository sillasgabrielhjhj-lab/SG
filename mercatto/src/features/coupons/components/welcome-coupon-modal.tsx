"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type CSSProperties } from "react";
import { ArrowRight, Gift, Sparkles, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { CouponTicket } from "@/features/coupons/components/coupon-ticket";
import { activateCampaignCouponAction } from "@/features/coupons/actions";
import type { WelcomeCampaignView } from "@/features/coupons/campaign.server";

const CONFETTI_COLORS = ["var(--color-brand-500)", "var(--color-sun-400)", "var(--color-coral-500)", "var(--color-brand-300)", "var(--color-sun-300)", "var(--color-info-600)"];

/** 18 confetes em leque, uma única vez (~1,1s) — posições determinísticas (sem Math.random no render). */
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (-160 + (i * 140) / 17) * (Math.PI / 180);
  const distance = 110 + (i % 4) * 28;
  return {
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 3 === 0,
    style: {
      "--cx": `${Math.cos(angle) * distance}px`,
      "--cy": `${Math.sin(angle) * distance * 0.75 + 70}px`,
      "--cr": `${(i % 2 ? 1 : -1) * (120 + i * 25)}deg`,
      "--confetti-delay": `${(i % 6) * 35}ms`,
    } as CSSProperties,
  };
});

/**
 * Pop-up "Presente de boas-vindas". <dialog> nativo: foco preso, ESC e clique
 * fora fecham, foco volta ao elemento de origem. Carregado sob demanda (não
 * pesa no carregamento inicial da página).
 */
export default function WelcomeCouponModal({ campaign, onClose }: { campaign: WelcomeCampaignView; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const [confetti, setConfetti] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    trackEvent("coupon_view", { coupon: campaign.code, source: "welcome_modal" });
    const t = window.setTimeout(() => setConfetti(false), 1600);
    return () => {
      window.clearTimeout(t);
      root.style.overflow = previous;
    };
  }, [campaign.code]);

  // Fecha o <dialog> antes de desmontar: o navegador devolve o foco ao elemento de origem.
  const finish = () => {
    ref.current?.close();
    onClose();
  };
  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(finish, 160);
  };

  const activate = () =>
    start(async () => {
      const res = await activateCampaignCouponAction({ code: campaign.code });
      trackEvent("coupon_applied", { coupon: campaign.code, source: "welcome_modal", success: res.ok });
      // Fecha antes do aviso: dentro do <dialog> ele ficaria atrás do fundo do modal.
      finish();
      if (!res.ok) {
        toast.error("Não foi possível ativar o cupom", { description: res.error });
        return;
      }
      toast.success("Cupom ativado ✓", { description: `O desconto do ${campaign.code} aparece no carrinho com produtos participantes.` });
      router.push(campaign.href);
    });

  // Destaques curtos (mínimo, teto e validade) — o resto fica na página de condições.
  const keyConditions = campaign.conditions.filter((c) => /^(Compras a partir|Desconto máximo|Válido até)/.test(c));

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[25rem] overflow-visible bg-transparent p-0 backdrop:bg-[oklch(0.2_0.03_200/0.55)] backdrop:backdrop-blur-[2px] backdrop:animate-fade-in"
    >
      <div className={`relative max-h-[calc(100dvh-1.5rem)] overflow-x-hidden overflow-y-auto rounded-[1.5rem] bg-surface shadow-glow ${closing ? "animate-fade-out" : "animate-modal-in"}`}>
        {confetti ? (
          <div aria-hidden className="pointer-events-none absolute top-16 left-1/2 z-10">
            {CONFETTI.map((c, i) => (
              <span key={i} style={{ ...c.style, background: c.color }} className={`absolute block animate-confetti ${c.round ? "size-2 rounded-full" : "h-2.5 w-1.5 rounded-[2px]"}`} />
            ))}
          </div>
        ) : null}

        <button type="button" onClick={close} aria-label="Fechar presente de boas-vindas" className="press absolute top-3 right-3 z-20 grid size-10 place-items-center rounded-full bg-surface/90 text-fg-muted shadow-sm ring-1 ring-line transition-colors hover:text-fg focus-ring">
          <X className="size-5" aria-hidden />
        </button>

        {/* Topo da marca */}
        <div className="relative overflow-hidden bg-brand-50 px-6 pt-8 pb-6 text-center">
          <span aria-hidden className="absolute -top-16 -left-12 size-40 rounded-full bg-brand-100" />
          <span aria-hidden className="absolute -right-10 -bottom-20 size-44 rounded-full bg-sun-100" />
          <Sparkles aria-hidden className="absolute top-6 left-8 size-4 animate-fade-up text-sun-500 [animation-delay:180ms]" />
          <Sparkles aria-hidden className="absolute top-14 right-14 size-3 animate-fade-up text-brand-500 [animation-delay:300ms]" />
          <Sparkles aria-hidden className="absolute bottom-6 left-14 size-3 animate-fade-up text-coral-500 [animation-delay:420ms]" />
          <div className="relative flex flex-col items-center">
            <span className="grid size-14 animate-check place-items-center rounded-2xl bg-brand-800 text-sun-300 shadow-raised [animation-delay:80ms]">
              <Gift className="size-7" aria-hidden />
            </span>
            <h2 id={titleId} className="mt-4 flex flex-col items-center">
              <span className="animate-fade-up text-sm font-bold tracking-wide text-brand-800 [animation-delay:120ms]">Presente de boas-vindas</span>
              <span className="mt-1 animate-fade-up text-5xl leading-none font-extrabold tracking-tight text-brand-900 [animation-delay:200ms] sm:text-6xl">{campaign.headline}</span>
              <span className="mt-2 animate-fade-up text-base font-semibold text-fg-muted [animation-delay:260ms]">em produtos selecionados</span>
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-5 pt-5 pb-6 sm:px-6">
          <div className="animate-fade-up [animation-delay:320ms]">
            <CouponTicket code={campaign.code} source="welcome_modal" />
          </div>
          {keyConditions.length ? (
            <ul className="flex animate-fade-up flex-wrap justify-center gap-1.5 [animation-delay:360ms]">
              {keyConditions.map((c) => (
                <li key={c} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-fg-muted ring-1 ring-line">
                  {c.replace(/\.$/, "")}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex animate-fade-up flex-col gap-2 [animation-delay:400ms]">
            <Button size="lg" fullWidth loading={pending} loadingText="Ativando cupom" onClick={activate} className="tracking-wide uppercase" rightIcon={<ArrowRight className="size-4" aria-hidden />}>
              Quero meu desconto
            </Button>
            <Link href={campaign.href} onClick={finish} className="press inline-flex h-11 items-center justify-center rounded-field text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-ring">
              Ver produtos participantes
            </Link>
          </div>
          <p id={descId} className="text-center text-xs leading-relaxed text-fg-subtle">
            Oferta válida para produtos selecionados.{" "}
            <Link href={`${campaign.href}#condicoes`} onClick={finish} className="font-semibold text-fg-muted underline underline-offset-2 hover:text-fg focus-ring">
              Consulte as condições
            </Link>
            .
          </p>
        </div>
      </div>
    </dialog>
  );
}
