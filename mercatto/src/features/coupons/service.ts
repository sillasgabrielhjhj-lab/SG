import "server-only";
import { db, type Tx } from "@/server/db";
import { evaluateCoupon, type CouponEvaluation, type CouponLine, type CouponRule } from "@/features/pricing/engine";
import { formatBRL } from "@/lib/money";

/**
 * Cupons: carregamento, contexto do usuário e validação com o motor de preços.
 * A validação definitiva acontece DENTRO da transação do checkout (com bloqueio
 * da linha do cupom); estas funções servem ao carrinho, ao checkout e à área
 * "Cupons" do cliente.
 */

/** Códigos são sempre armazenados em MAIÚSCULAS, sem espaços. */
export function normalizeCouponCode(code: string): string {
  return code.normalize("NFKC").replace(/\s+/g, "").toUpperCase().slice(0, 40);
}

const COUPON_SELECT = {
  id: true,
  code: true,
  description: true,
  type: true,
  value: true,
  maxDiscountCents: true,
  minOrderCents: true,
  startsAt: true,
  endsAt: true,
  usageLimit: true,
  usageLimitPerUser: true,
  usedCount: true,
  firstPurchaseOnly: true,
  stackWithPromotions: true,
  productIds: true,
  categoryIds: true,
  storeId: true,
  isActive: true,
  isPublic: true,
} as const;

export type LoadedCoupon = CouponRule & { description: string | null; isPublic: boolean };

/** Carrega o cupom pelo código (normalizado). Retorna null se não existir. */
export async function loadCouponForEvaluation(code: string, tx?: Tx): Promise<LoadedCoupon | null> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  const row = await (tx ?? db).coupon.findUnique({ where: { code: normalized }, select: COUPON_SELECT });
  return row;
}

export async function loadCouponById(couponId: string, tx?: Tx): Promise<LoadedCoupon | null> {
  const row = await (tx ?? db).coupon.findUnique({ where: { id: couponId }, select: COUPON_SELECT });
  return row;
}

export type UserCouponContext = { userUsageCount: number; userCompletedOrders: number };

/**
 * Usos do cupom pelo usuário (resgates ativos — resgates de compras canceladas
 * ou expiradas são removidos) e quantidade de pedidos pagos anteriores.
 */
export async function getUserCouponContext(userId: string, couponId: string, tx?: Tx): Promise<UserCouponContext> {
  const client = tx ?? db;
  const [userUsageCount, userCompletedOrders] = await Promise.all([
    client.couponRedemption.count({ where: { couponId, userId } }),
    client.order.count({ where: { userId, paidAt: { not: null } } }),
  ]);
  return { userUsageCount, userCompletedOrders };
}

export type CouponValidation =
  | { ok: true; coupon: LoadedCoupon; evaluation: Extract<CouponEvaluation, { ok: true }> }
  | { ok: false; coupon: LoadedCoupon | null; reason: string };

/**
 * Valida um cupom para as linhas informadas. Visitantes (userId null) são
 * avaliados sem histórico — a validação final exige login no checkout.
 */
export async function validateCouponForLines(input: {
  code: string;
  userId: string | null;
  lines: CouponLine[];
  shippingCents: number;
  /** Frete por loja (cupons de vendedor só descontam o frete da própria loja). */
  shippingByStore?: Record<string, number>;
  now?: Date;
  tx?: Tx;
}): Promise<CouponValidation> {
  const coupon = await loadCouponForEvaluation(input.code, input.tx);
  if (!coupon) return { ok: false, coupon: null, reason: "Cupom não encontrado. Confira o código digitado." };
  return evaluateLoadedCoupon(coupon, input);
}

export async function evaluateLoadedCoupon(
  coupon: LoadedCoupon,
  input: {
    userId: string | null;
    lines: CouponLine[];
    shippingCents: number;
    shippingByStore?: Record<string, number>;
    now?: Date;
    tx?: Tx;
  },
): Promise<CouponValidation> {
  const ctx = input.userId
    ? await getUserCouponContext(input.userId, coupon.id, input.tx)
    : { userUsageCount: 0, userCompletedOrders: 0 };
  const shippingCents =
    coupon.storeId && input.shippingByStore ? (input.shippingByStore[coupon.storeId] ?? 0) : input.shippingCents;
  const evaluation = evaluateCoupon(coupon, input.lines, { ...ctx, shippingCents, now: input.now });
  if (!evaluation.ok) {
    const reason =
      evaluation.reason.startsWith("Valor mínimo") && coupon.minOrderCents > 0
        ? `Este cupom vale para compras a partir de ${formatBRL(coupon.minOrderCents)}.`
        : evaluation.reason;
    return { ok: false, coupon, reason };
  }
  return { ok: true, coupon, evaluation };
}

/** Descrição curta do benefício ("10% OFF até R$ 50,00", "R$ 20,00 OFF", "Frete grátis"). */
export function describeCouponBenefit(coupon: Pick<CouponRule, "type" | "value" | "maxDiscountCents">): string {
  if (coupon.type === "FREE_SHIPPING") {
    return coupon.maxDiscountCents ? `Frete grátis até ${formatBRL(coupon.maxDiscountCents)}` : "Frete grátis";
  }
  if (coupon.type === "PERCENT") {
    return coupon.maxDiscountCents ? `${coupon.value}% OFF até ${formatBRL(coupon.maxDiscountCents)}` : `${coupon.value}% OFF`;
  }
  return `${formatBRL(coupon.value)} OFF`;
}

export type PublicCouponView = {
  id: string;
  code: string;
  description: string | null;
  benefit: string;
  minOrderCents: number;
  endsAt: string | null;
  storeName: string | null;
  storeSlug: string | null;
  firstPurchaseOnly: boolean;
  usable: boolean;
  /** Motivo quando não utilizável (limite atingido, já usado, etc.). */
  reason: string | null;
};

/** Cupons públicos ativos para a área "Cupons" do cliente, com status de uso. */
export async function listPublicCoupons(userId: string, now: Date = new Date()): Promise<PublicCouponView[]> {
  const coupons = await db.coupon.findMany({
    where: {
      isActive: true,
      isPublic: true,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: [{ endsAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
    select: { ...COUPON_SELECT, store: { select: { name: true, slug: true, status: true } } },
  });
  const visible = coupons.filter((c) => !c.store || c.store.status === "ACTIVE");
  if (visible.length === 0) return [];

  const [redemptions, completedOrders] = await Promise.all([
    db.couponRedemption.groupBy({
      by: ["couponId"],
      where: { userId, couponId: { in: visible.map((c) => c.id) } },
      _count: { _all: true },
    }),
    db.order.count({ where: { userId, paidAt: { not: null } } }),
  ]);
  const usage = new Map(redemptions.map((r) => [r.couponId, r._count._all]));

  return visible.map((c) => {
    let reason: string | null = null;
    if (c.startsAt && now < c.startsAt) reason = "Disponível em breve.";
    else if (c.usageLimit !== null && c.usedCount >= c.usageLimit) reason = "Esgotado.";
    else if (c.usageLimitPerUser !== null && (usage.get(c.id) ?? 0) >= c.usageLimitPerUser) reason = "Você já utilizou este cupom.";
    else if (c.firstPurchaseOnly && completedOrders > 0) reason = "Válido somente na primeira compra.";
    return {
      id: c.id,
      code: c.code,
      description: c.description,
      benefit: describeCouponBenefit(c),
      minOrderCents: c.minOrderCents,
      endsAt: c.endsAt?.toISOString() ?? null,
      storeName: c.store?.name ?? null,
      storeSlug: c.store?.slug ?? null,
      firstPurchaseOnly: c.firstPurchaseOnly,
      usable: reason === null,
      reason,
    };
  });
}
