export const ORDER_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PREPARING_SHIPMENT: "Preparando envio",
  SHIPPED: "Enviado",
  IN_TRANSIT: "Em trânsito",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  RETURNED: "Devolvido",
};

export const ORDER_STATUS_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  AWAITING_PAYMENT: "warning",
  PAYMENT_APPROVED: "default",
  PREPARING_SHIPMENT: "default",
  SHIPPED: "default",
  IN_TRANSIT: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
  RETURNED: "secondary",
};

export const CANCELLABLE_STATUSES = ["AWAITING_PAYMENT", "PAYMENT_APPROVED", "PREPARING_SHIPMENT"];
export const RETURNABLE_STATUSES = ["DELIVERED"];

/** Próximo status que um vendedor (externo ou o próprio Mercatto, via
 * admin) pode avançar manualmente — compartilhado entre
 * src/lib/actions/seller.ts e src/lib/actions/admin-orders.ts. */
export const SELLER_NEXT_STATUS: Record<string, string> = {
  PAYMENT_APPROVED: "PREPARING_SHIPMENT",
  PREPARING_SHIPMENT: "SHIPPED",
  SHIPPED: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

export const STATUS_ADVANCE_NOTIFICATION: Partial<Record<string, { title: string; message: string }>> = {
  SHIPPED: { title: "Pedido enviado!", message: "Seu pedido foi enviado e está a caminho." },
  IN_TRANSIT: { title: "Pedido em trânsito", message: "Seu pedido está em trânsito até você." },
  DELIVERED: { title: "Pedido entregue!", message: "Seu pedido foi entregue. Aproveite a compra!" },
};
