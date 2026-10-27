/**
 * Estados de um pagamento. O Pix estático (QR Code gerado no próprio site) NÃO permite saber se o
 * pagamento foi feito, por isso o único estado possível hoje é "unconfirmed". Os demais ficam
 * reservados para uma futura integração com uma API Pix (cobrança dinâmica + webhook). Nunca
 * simulamos "paid".
 */
export type PaymentStatus = "unconfirmed" | "pending" | "paid" | "expired";

export interface PixPayment {
  amountCents: number;
  /** Texto do "Pix Copia e Cola"; é exatamente o conteúdo do QR Code. */
  payload: string;
  status: PaymentStatus;
}
