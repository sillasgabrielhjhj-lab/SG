"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/components/ui/toast";

/**
 * Cartão do cupom com picote e botão "Copiar cupom" → "Cupom copiado ✓".
 * Compartilhado pelo pop-up de boas-vindas e pela página /cupom/[code].
 */
export function CouponTicket({ code, className, source }: { code: string; className?: string; source: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const button = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    if (!(await copyText(code))) {
      toast.error("Não foi possível copiar", { description: `Anote o código: ${code}` });
      return;
    }
    setCopied(true);
    trackEvent("coupon_copy", { coupon: code, source });
    // Dentro do pop-up o próprio botão confirma (o aviso ficaria atrás do fundo do modal).
    if (!button.current?.closest("dialog")) toast.success("Cupom copiado ✓", { description: `${code} já está na sua área de transferência.`, duration: 2500 });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2400);
  };

  return (
    <div className={cn("shine-once relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-card border-2 border-dashed border-sun-400 bg-sun-50 py-3 pr-3 pl-4", className)}>
      {/* Picotes laterais */}
      <span aria-hidden className="absolute top-1/2 -left-[11px] size-5 -translate-y-1/2 rounded-full border-2 border-sun-400 bg-surface [clip-path:inset(0_0_0_50%)]" />
      <span aria-hidden className="absolute top-1/2 -right-[11px] size-5 -translate-y-1/2 rounded-full border-2 border-sun-400 bg-surface [clip-path:inset(0_50%_0_0)]" />
      <div className="shrink-0">
        <p className="text-2xs font-bold tracking-wider text-sun-800 uppercase">Seu cupom</p>
        <p className="font-mono text-xl font-extrabold tracking-[0.06em] break-all text-fg">{code}</p>
      </div>
      <button
        ref={button}
        type="button"
        onClick={copy}
        aria-label={copied ? `Cupom ${code} copiado` : `Copiar cupom ${code}`}
        className={cn(
          "press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field px-3 text-sm font-bold transition-colors focus-ring",
          copied ? "bg-success-600 text-white" : "bg-surface text-brand-800 ring-1 ring-sun-400 hover:bg-white hover:ring-brand-600",
        )}
      >
        {copied ? <Check key="ok" className="size-4 animate-check" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        <span aria-live="polite">{copied ? "Cupom copiado" : "Copiar cupom"}</span>
      </button>
    </div>
  );
}
