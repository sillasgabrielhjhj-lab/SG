"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Só decora visualmente uma promoção que o servidor já validou como ativa
 * (isPromotionActive em src/lib/pricing.ts) — o relógio do navegador nunca
 * decide se o desconto vale, só mostra quanto tempo falta pro que o banco
 * já determinou como prazo final. Se o prazo passar enquanto a página está
 * aberta, para de contar e some sozinho no próximo carregamento/revalidação
 * (o preço real já volta ao normal no servidor).
 */
export function PromotionCountdown({ endsAt }: { endsAt: Date | string }) {
  const target = new Date(endsAt).getTime();
  const [msLeft, setMsLeft] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => setMsLeft(target - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (msLeft <= 0) return null;

  const totalSeconds = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const label = days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
      <Clock className="size-3.5" />
      Oferta termina em {label}
    </p>
  );
}
