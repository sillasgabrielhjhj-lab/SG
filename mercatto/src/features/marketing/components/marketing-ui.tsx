import Link from "next/link";
import type { ReactNode } from "react";
import { Ban, CalendarClock, CheckCircle2, CircleSlash, Clock, PauseCircle, Zap } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";

/**
 * Peças de UI compartilhadas do marketing (promoções, cupons, campanhas).
 * Sem hooks: utilizáveis em Server e Client Components.
 */

export type MarketingMode = "seller" | "admin";
export type PromotionState = "SCHEDULED" | "ACTIVE" | "EXPIRED" | "CANCELLED";
export type PromotionKind = "PERCENT_OFF" | "AMOUNT_OFF" | "FIXED_PRICE";
export type CouponState = "ACTIVE" | "INACTIVE" | "EXPIRED" | "SCHEDULED" | "EXHAUSTED";
export type CouponKind = "PERCENT" | "FIXED" | "FREE_SHIPPING";
export type CampaignState = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE";

const icon = "size-3";

export const PROMOTION_STATE: Record<PromotionState, { label: string; tone: BadgeTone; icon: ReactNode }> = {
  ACTIVE: { label: "Ativa", tone: "success", icon: <CheckCircle2 className={icon} aria-hidden /> },
  SCHEDULED: { label: "Agendada", tone: "info", icon: <CalendarClock className={icon} aria-hidden /> },
  EXPIRED: { label: "Encerrada", tone: "neutral", icon: <Clock className={icon} aria-hidden /> },
  CANCELLED: { label: "Cancelada", tone: "danger", icon: <Ban className={icon} aria-hidden /> },
};

export const PROMOTION_TYPE: Record<PromotionKind, { label: string; description: string }> = {
  PERCENT_OFF: { label: "Percentual", description: "Desconto de 1% a 90% sobre o preço" },
  AMOUNT_OFF: { label: "Valor de desconto", description: "Abate um valor fixo em R$ do preço" },
  FIXED_PRICE: { label: "Preço promocional", description: "O produto sai por um preço fixo" },
};

export function formatPromotionValue(type: PromotionKind, value: number) {
  if (type === "PERCENT_OFF") return `${value}% OFF`;
  if (type === "AMOUNT_OFF") return `${formatBRL(value)} OFF`;
  return `Por ${formatBRL(value)}`;
}

export const COUPON_STATE: Record<CouponState, { label: string; tone: BadgeTone; icon: ReactNode }> = {
  ACTIVE: { label: "Ativo", tone: "success", icon: <CheckCircle2 className={icon} aria-hidden /> },
  SCHEDULED: { label: "Agendado", tone: "info", icon: <CalendarClock className={icon} aria-hidden /> },
  EXHAUSTED: { label: "Esgotado", tone: "warning", icon: <CircleSlash className={icon} aria-hidden /> },
  EXPIRED: { label: "Expirado", tone: "neutral", icon: <Clock className={icon} aria-hidden /> },
  INACTIVE: { label: "Inativo", tone: "neutral", icon: <PauseCircle className={icon} aria-hidden /> },
};

export const COUPON_TYPE: Record<CouponKind, { label: string; description: string }> = {
  PERCENT: { label: "Percentual", description: "% sobre o subtotal elegível" },
  FIXED: { label: "Valor fixo", description: "Abate um valor em R$ do pedido" },
  FREE_SHIPPING: { label: "Frete grátis", description: "Zera o frete da loja" },
};

/** Mesma regra de `listCoupons` (queries) para a tela de edição. */
export function couponState(c: { isActive: boolean; startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; usedCount: number }, now = new Date()): CouponState {
  if (!c.isActive) return "INACTIVE";
  if (c.endsAt && c.endsAt <= now) return "EXPIRED";
  if (c.startsAt && c.startsAt > now) return "SCHEDULED";
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return "EXHAUSTED";
  return "ACTIVE";
}

export function formatCouponValue(type: CouponKind, value: number, maxDiscountCents?: number | null) {
  if (type === "FREE_SHIPPING") return "Frete grátis";
  if (type === "FIXED") return `${formatBRL(value)} OFF`;
  return `${value}% OFF${maxDiscountCents ? ` (máx. ${formatBRL(maxDiscountCents)})` : ""}`;
}

export const CAMPAIGN_STATE: Record<CampaignState, { label: string; tone: BadgeTone; icon: ReactNode }> = {
  ACTIVE: { label: "No ar", tone: "success", icon: <CheckCircle2 className={icon} aria-hidden /> },
  SCHEDULED: { label: "Agendada", tone: "info", icon: <CalendarClock className={icon} aria-hidden /> },
  EXPIRED: { label: "Encerrada", tone: "neutral", icon: <Clock className={icon} aria-hidden /> },
  INACTIVE: { label: "Desativada", tone: "neutral", icon: <PauseCircle className={icon} aria-hidden /> },
};

export function campaignState(c: { isActive: boolean; startsAt: Date | string; endsAt: Date | string }, now = new Date()): CampaignState {
  if (!c.isActive) return "INACTIVE";
  if (new Date(c.startsAt) > now) return "SCHEDULED";
  if (new Date(c.endsAt) <= now) return "EXPIRED";
  return "ACTIVE";
}

export function StateBadge({ meta, size = "sm" }: { meta: { label: string; tone: BadgeTone; icon: ReactNode }; size?: "xs" | "sm" }) {
  return (
    <Badge tone={meta.tone} size={size} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

export function FlashBadge({ size = "xs" }: { size?: "xs" | "sm" }) {
  return (
    <Badge tone="sun" size={size} icon={<Zap className="size-3" aria-hidden />}>
      Relâmpago
    </Badge>
  );
}

/** Abas de filtro por link (estado na URL). */
export function FilterTabs({ label, tabs, className }: { label: string; tabs: { key: string; label: string; href: string; active: boolean }[]; className?: string }) {
  return (
    <nav aria-label={label} className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0", className)}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap focus-ring",
            t.active ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-line bg-surface text-fg-muted hover:border-brand-300",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Monta hrefs preservando filtros (valores vazios e página 1 são omitidos). */
export function buildListHref(basePath: string, params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && !(k === "pagina" && Number(v) <= 1)) q.set(k, String(v));
  const s = q.toString();
  return `${basePath}${s ? `?${s}` : ""}`;
}

/** Card de seção dos formulários. */
export function FormSection({ id, title, description, children, aside }: { id: string; title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24 rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="font-bold">
            {title}
          </h2>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Lista de erros do formulário (topo). */
export function FormErrorBox({ message, errors }: { message: string | null; errors: Record<string, string[]> }) {
  if (!message) return null;
  const list = Object.entries(errors).slice(0, 6);
  return (
    <div role="alert" className="rounded-card border border-danger-600/30 bg-danger-50 p-4 text-sm text-danger-700">
      <p className="font-semibold">{message}</p>
      {list.length ? (
        <ul className="mt-1 list-disc pl-5">
          {list.map(([k, v]) => (
            <li key={k}>{v[0]}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Erros de update vêm prefixados com "input." (schema { id, input }). */
export function normalizeFieldErrors(errors: Record<string, string[]> | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(errors ?? {})) out[k.startsWith("input.") ? k.slice(6) : k] = v;
  return out;
}
