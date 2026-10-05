/**
 * Contrato de gateway de pagamento. A aplicação NUNCA depende de um gateway
 * específico: checkout/pedidos falam apenas com esta interface.
 *
 * Implementações:
 *  - "dev": gateway de DESENVOLVIMENTO. Não movimenta dinheiro. Gera PIX de
 *    demonstração (inválido para pagamento) e permite simular aprovação/recusa
 *    disparando o MESMO fluxo de webhook assinado usado em produção.
 *  - "mercadopago": integração real via API REST (requer credenciais).
 */
export type PaymentMethodCode = "PIX" | "CREDIT_CARD";

export type CreatePaymentInput = {
  /** Chave idempotente (mesma chave => mesmo pagamento no gateway). */
  idempotencyKey: string;
  /** Id interno do pagamento (referência externa no gateway). */
  paymentId: string;
  amountCents: number;
  method: PaymentMethodCode;
  installments: number;
  description: string;
  payer: { name: string; email: string; cpf: string; phone?: string | null };
  /** Somente para cartão: token gerado no navegador pelo SDK do gateway. Nunca o PAN. */
  cardToken?: string | null;
  /** Bandeira/últimos dígitos informados pelo SDK (opcional, apenas exibição). */
  cardBrand?: string | null;
  cardLast4?: string | null;
  /**
   * Somente cartão: identificadores devolvidos pelo SDK do gateway no navegador
   * (Mercado Pago: `payment_method_id`, ex. "visa"/"master", e `issuer_id`).
   */
  paymentMethodId?: string | null;
  issuerId?: string | null;
  expiresAt: Date;
  notificationUrl: string;
};

export type GatewayPaymentStatus = "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export type CreatePaymentResult = {
  providerPaymentId: string;
  status: GatewayPaymentStatus;
  pix?: { qrCode: string; qrCodeImageDataUrl: string; expiresAt: Date };
  card?: { brand: string | null; last4: string | null };
  failureReason?: string | null;
  isSandbox: boolean;
};

export type WebhookVerification =
  | {
      ok: true;
      /** Id único do evento no provedor (idempotência). */
      eventId: string;
      type: string;
      providerPaymentId: string;
      /** Status consultado/confirmado no provedor (não confiar só no corpo). */
      status: GatewayPaymentStatus;
      paidAmountCents?: number;
      /** Referência externa registrada no gateway (= id interno do Payment), quando disponível. */
      externalReference?: string | null;
      raw: unknown;
    }
  | {
      ok: false;
      reason: string;
      /**
       * true quando o evento é autêntico mas irrelevante (ex.: tipo de evento não
       * tratado): responda 2xx para o provedor não reenviar, sem processar nada.
       */
      ignorable?: boolean;
    };

export type RefundResult = { providerRefundId: string; status: "PENDING" | "SUCCEEDED" | "FAILED" };

export interface PaymentGateway {
  readonly name: string;
  /** true quando nenhuma cobrança real é realizada. */
  readonly isSandbox: boolean;
  readonly supportsMethods: PaymentMethodCode[];
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Consulta status atual no provedor (fonte da verdade). */
  getPaymentStatus(providerPaymentId: string): Promise<GatewayPaymentStatus>;
  cancelPayment(providerPaymentId: string): Promise<void>;
  refund(providerPaymentId: string, amountCents: number, idempotencyKey: string): Promise<RefundResult>;
  /** Valida assinatura e extrai o evento. Corpo bruto é necessário para HMAC. */
  verifyWebhook(request: { headers: Headers; rawBody: string; url: string }): Promise<WebhookVerification>;
}
