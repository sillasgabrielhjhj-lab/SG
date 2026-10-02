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
