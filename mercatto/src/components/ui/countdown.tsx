"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useNowSecond } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60, total };
}
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Contador regressivo real. Renderiza placeholder estável até montar (sem
 * hydration mismatch). Ao zerar chama onExpire e, por padrão, atualiza a página
 * para o servidor refletir o novo estado (oferta encerrada).
 */
export function Countdown({ endsAt, onExpire, refreshOnExpire = true, className, variant = "blocks", label = "Termina em" }: { endsAt: string; onExpire?: () => void; refreshOnExpire?: boolean; className?: string; variant?: "blocks" | "inline" | "labeled"; label?: string }) {
  const router = useRouter();
  const now = useNowSecond();
  const fired = useRef(false);
  const end = new Date(endsAt).getTime();

  const p = parts(now === null ? end - Date.parse(endsAt) + 1 : end - now);
  useEffect(() => {
    if (now !== null && p.total === 0 && !fired.current) {
      fired.current = true;
      onExpire?.();
      if (refreshOnExpire) router.refresh();
    }
  }, [now, p.total, onExpire, refreshOnExpire, router]);

  const text = now === null ? "--:--:--" : p.total === 0 ? "Encerrada" : `${p.days > 0 ? `${p.days}d ` : ""}${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
  if (variant === "inline") {
    return (
      <span className={cn("tabular", className)} role="timer" aria-live="off" aria-label={`${label} ${text}`}>
        {text}
      </span>
    );
  }
  const blocks = now === null ? ["--", "--", "--"] : [pad(p.days * 24 + p.hours), pad(p.minutes), pad(p.seconds)];
  if (variant === "labeled") {
    return (
      <span role="timer" aria-label={`${label} ${text}`} className={cn("inline-flex items-start gap-1.5 tabular", className)}>
        {p.total === 0 && now !== null ? (
          <span className="rounded-md bg-fg/80 px-2.5 py-1.5 text-xs font-bold text-white">Encerrada</span>
        ) : (
          blocks.map((b, i) => (
            <span key={i} className="flex items-start gap-1.5" aria-hidden>
              <span className="flex flex-col items-center gap-0.5">
                <span className="min-w-10 rounded-lg bg-fg px-1.5 py-1.5 text-center text-lg leading-none font-extrabold text-white shadow-sm">{b}</span>
                <span className="text-[10px] font-bold tracking-wider uppercase opacity-80">{["Horas", "Min", "Seg"][i]}</span>
              </span>
              {i < 2 ? <span className="pt-1 text-lg leading-none font-extrabold">:</span> : null}
            </span>
          ))
        )}
      </span>
    );
  }
  return (
    <span role="timer" aria-label={`${label} ${text}`} className={cn("inline-flex items-center gap-1 tabular", className)}>
      {p.total === 0 && now !== null ? (
        <span className="rounded-md bg-fg/80 px-2 py-1 text-xs font-bold text-white">Encerrada</span>
      ) : (
        blocks.map((b, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="min-w-8 rounded-md bg-fg px-1.5 py-1 text-center text-sm font-bold text-white">{b}</span>
            {i < 2 ? <span className="font-bold">:</span> : null}
          </span>
        ))
      )}
    </span>
  );
}
