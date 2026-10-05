/**
 * Máquina de estados dos pedidos (isomórfica: usada no servidor para
 * autorizar transições e na UI para rótulos, cores, linha do tempo e ações).
 *
 * Fluxo principal:
 *   PENDING_PAYMENT -> PAID -> PROCESSING -> SHIPPED -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED
 * Desvios:
 *   - CANCELLED: antes do envio (cliente enquanto aguarda pagamento; vendedor/admin com motivo; sistema na expiração).
 *   - REFUND_REQUESTED: cliente pede cancelamento de pedido pago ainda não enviado, ou devolução após a entrega.
 *     Aprovação => REFUNDED (via reembolso). Recusa => volta ao status ANTERIOR à solicitação
 *     (PAID, PROCESSING ou DELIVERED), registrado nos eventos do pedido.
 */
import type { OrderStatus } from "@/generated/prisma/enums";

export type OrderActorRole = "CUSTOMER" | "SELLER" | "ADMIN" | "SYSTEM";

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUND_REQUESTED",
  "REFUNDED",
] as const satisfies readonly OrderStatus[];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pagamento aprovado",
  PROCESSING: "Em preparação",
  SHIPPED: "Enviado",
  IN_TRANSIT: "Em trânsito",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  REFUND_REQUESTED: "Reembolso solicitado",
  REFUNDED: "Reembolsado",
};

/** Descrição curta exibida ao comprador abaixo do status. */
export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Assim que o pagamento for confirmado, avisaremos o vendedor.",
  PAID: "Pagamento confirmado. O vendedor vai preparar seu pedido.",
  PROCESSING: "O vendedor está separando e embalando seus produtos.",
  SHIPPED: "Seu pedido foi entregue à transportadora.",
  IN_TRANSIT: "Seu pedido está a caminho.",
  OUT_FOR_DELIVERY: "Seu pedido sai para entrega hoje.",
  DELIVERED: "Pedido entregue. Conte o que achou dos produtos!",
  CANCELLED: "Este pedido foi cancelado.",
  REFUND_REQUESTED: "Sua solicitação está em análise.",
  REFUNDED: "O valor foi estornado para a forma de pagamento original.",
};

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger" | "brand";

export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  PROCESSING: "info",
  SHIPPED: "brand",
  IN_TRANSIT: "brand",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUND_REQUESTED: "warning",
  REFUNDED: "neutral",
};

/** Classes do design system para badges de status (texto com contraste AA sobre o fundo). */
export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-surface-muted text-fg-muted border-line",
  info: "bg-info-50 text-info-700 border-info-600/30",
  warning: "bg-warning-50 text-warning-700 border-warning-600/30",
  success: "bg-success-50 text-success-700 border-success-600/30",
  danger: "bg-danger-50 text-danger-700 border-danger-600/30",
  brand: "bg-brand-50 text-brand-800 border-brand-600/30",
};

export const orderStatusBadgeClass = (status: OrderStatus) => STATUS_TONE_CLASSES[ORDER_STATUS_TONES[status]];

/** Etapas exibidas na linha do tempo do pedido (fluxo feliz). */
export const ORDER_TIMELINE_STEPS = [
  { status: "PENDING_PAYMENT", label: "Pedido realizado" },
  { status: "PAID", label: "Pagamento aprovado" },
  { status: "PROCESSING", label: "Em preparação" },
  { status: "SHIPPED", label: "Enviado" },
  { status: "IN_TRANSIT", label: "Em trânsito" },
  { status: "OUT_FOR_DELIVERY", label: "Saiu para entrega" },
  { status: "DELIVERED", label: "Entregue" },
] as const satisfies readonly { status: OrderStatus; label: string }[];

/** Status a partir dos quais o cliente pode pedir cancelamento/reembolso. */
export const REFUNDABLE_FROM = ["PAID", "PROCESSING", "DELIVERED"] as const satisfies readonly OrderStatus[];

/** Status "ativos" antes do envio: ainda podem ser cancelados pelo vendedor/admin. */
export const PRE_SHIPMENT_STATUSES = ["PAID", "PROCESSING"] as const satisfies readonly OrderStatus[];

export const FINAL_STATUSES = ["CANCELLED", "REFUNDED"] as const satisfies readonly OrderStatus[];

/**
 * Prazo (dias corridos após a entrega) para o direito de arrependimento —
 * art. 49 do CDC prevê 7 dias para compras fora do estabelecimento.
 * Configurável aqui; a política comercial pode ampliar o prazo.
 */
export const RETURN_WINDOW_DAYS = 7;

type Rule = { to: OrderStatus; actors: readonly OrderActorRole[] };

const STAFF: readonly OrderActorRole[] = ["SELLER", "ADMIN"];
const LOGISTICS: readonly OrderActorRole[] = ["SELLER", "ADMIN", "SYSTEM"];

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly Rule[]> = {
  PENDING_PAYMENT: [
    { to: "PAID", actors: ["SYSTEM"] },
    { to: "CANCELLED", actors: ["CUSTOMER", "ADMIN", "SYSTEM"] },
  ],
  PAID: [
    { to: "PROCESSING", actors: STAFF },
    { to: "CANCELLED", actors: ["SELLER", "ADMIN", "SYSTEM"] },
    { to: "REFUND_REQUESTED", actors: ["CUSTOMER", "ADMIN"] },
  ],
  PROCESSING: [
    { to: "SHIPPED", actors: STAFF },
    { to: "CANCELLED", actors: ["SELLER", "ADMIN", "SYSTEM"] },
    { to: "REFUND_REQUESTED", actors: ["CUSTOMER", "ADMIN"] },
  ],
  SHIPPED: [
    { to: "IN_TRANSIT", actors: LOGISTICS },
    { to: "OUT_FOR_DELIVERY", actors: LOGISTICS },
    { to: "DELIVERED", actors: LOGISTICS },
  ],
  IN_TRANSIT: [
    { to: "OUT_FOR_DELIVERY", actors: LOGISTICS },
    { to: "DELIVERED", actors: LOGISTICS },
  ],
  OUT_FOR_DELIVERY: [{ to: "DELIVERED", actors: LOGISTICS }],
  DELIVERED: [{ to: "REFUND_REQUESTED", actors: ["CUSTOMER", "ADMIN"] }],
  REFUND_REQUESTED: [
    { to: "REFUNDED", actors: ["SELLER", "ADMIN", "SYSTEM"] },
    // Recusa: volta ao status anterior à solicitação (validado no serviço com o histórico).
    { to: "PAID", actors: STAFF },
    { to: "PROCESSING", actors: STAFF },
    { to: "DELIVERED", actors: STAFF },
  ],
  CANCELLED: [],
  REFUNDED: [],
};

/** A transição existe no fluxo e o papel informado pode executá-la? */
export function canTransition(from: OrderStatus, to: OrderStatus, actorRole: OrderActorRole): boolean {
  return ORDER_TRANSITIONS[from].some((r) => r.to === to && r.actors.includes(actorRole));
}

/** Próximos status permitidos para um papel (para montar menus de ação). */
export function allowedTransitions(from: OrderStatus, actorRole: OrderActorRole): OrderStatus[] {
  return ORDER_TRANSITIONS[from].filter((r) => r.actors.includes(actorRole)).map((r) => r.to);
}

export const isFinalStatus = (status: OrderStatus) => (FINAL_STATUSES as readonly OrderStatus[]).includes(status);

/** Retornos de REFUND_REQUESTED (recusa) — destino válido é sempre o status anterior. */
export const isRefundRejection = (from: OrderStatus, to: OrderStatus) =>
  from === "REFUND_REQUESTED" && (REFUNDABLE_FROM as readonly OrderStatus[]).includes(to);

export type TimelineEvent = { status: OrderStatus; createdAt: Date | string; note?: string | null };

export type TimelineStep = {
  status: OrderStatus;
  label: string;
  state: "done" | "current" | "upcoming";
  at: string | null;
  note: string | null;
};

/** Etapas de logística que podem ser puladas pelo vendedor/transportadora. */
const OPTIONAL_STEPS: readonly OrderStatus[] = ["IN_TRANSIT", "OUT_FOR_DELIVERY"];

const sortEvents = (events: TimelineEvent[]) =>
  [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const happyIndex = (s: OrderStatus) => ORDER_TIMELINE_STEPS.findIndex((step) => step.status === s);

/**
 * Monta a linha do tempo a partir dos eventos (OrderEvent). O fluxo feliz é
 * exibido com as datas das etapas concluídas; desvios (cancelamento,
 * reembolso) aparecem como etapas finais adicionais.
 */
export function buildOrderTimeline(currentStatus: OrderStatus, events: TimelineEvent[]): TimelineStep[] {
  const sorted = sortEvents(events);
  const firstAt = new Map<OrderStatus, { at: string; note: string | null }>();
  for (const e of sorted) {
    if (!firstAt.has(e.status)) firstAt.set(e.status, { at: new Date(e.createdAt).toISOString(), note: e.note ?? null });
  }

  const deviation = happyIndex(currentStatus) < 0;
  // Etapa de referência: a atual ou, em desvios, a última alcançada antes deles.
  const reachedIndex = deviation
    ? sorted.reduce((max, e) => Math.max(max, happyIndex(e.status)), 0)
    : happyIndex(currentStatus);

  const steps: TimelineStep[] = [];
  ORDER_TIMELINE_STEPS.forEach((step, i) => {
    const event = firstAt.get(step.status);
    if (deviation && i > reachedIndex) return; // etapas que não acontecerão mais
    if (!event && i < reachedIndex && OPTIONAL_STEPS.includes(step.status)) return; // etapas puladas
    const state: TimelineStep["state"] =
      i < reachedIndex || (deviation && i === reachedIndex) ? "done" : i === reachedIndex ? "current" : "upcoming";
    steps.push({ status: step.status, label: step.label, state, at: event?.at ?? null, note: event?.note ?? null });
  });

  if (deviation) {
    const lastHappyAt = sorted.reduce((acc, e, i) => (happyIndex(e.status) === reachedIndex ? i : acc), -1);
    const extra = sorted.slice(lastHappyAt + 1).filter((e) => happyIndex(e.status) < 0);
    if (extra.length === 0) extra.push({ status: currentStatus, createdAt: new Date(0), note: null });
    extra.forEach((e, i) => {
      const isLast = i === extra.length - 1;
      steps.push({
        status: e.status,
        label: ORDER_STATUS_LABELS[e.status],
        state: isLast ? "current" : "done",
        at: new Date(e.createdAt).getTime() > 0 ? new Date(e.createdAt).toISOString() : null,
        note: e.note ?? null,
      });
    });
  }
  return steps;
}

/**
 * Status anterior à solicitação de reembolso mais recente (destino da recusa).
 * Retorna null se não houver histórico válido.
 */
export function statusBeforeRefundRequest(events: TimelineEvent[]): OrderStatus | null {
  const sorted = sortEvents(events);
  let lastRequestIndex = -1;
  sorted.forEach((e, i) => {
    if (e.status === "REFUND_REQUESTED") lastRequestIndex = i;
  });
  for (let i = lastRequestIndex - 1; i >= 0; i--) {
    const status = sorted[i]!.status;
    if ((REFUNDABLE_FROM as readonly OrderStatus[]).includes(status)) return status;
  }
  return null;
}
