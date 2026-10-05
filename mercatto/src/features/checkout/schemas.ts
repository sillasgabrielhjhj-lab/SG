import { z } from "zod";
import { cpfSchema, phoneSchema } from "@/lib/validators/br";
import { optionalText } from "@/lib/validators/common";

export const checkoutInputSchema = z.object({
  /** Gerada no navegador ao abrir o checkout; reenvios retornam a mesma compra. */
  idempotencyKey: z.string().uuid("Sessão de checkout inválida. Recarregue a página."),
  addressId: z.string().min(1, "Escolha o endereço de entrega").max(64),
  /** { [storeId]: optionId } */
  shippingSelections: z.record(z.string().min(1).max(64), z.string().min(1).max(120)),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD"]),
  installments: z.coerce.number().int().min(1).max(24).default(1),
  /** Token do SDK do gateway (nunca o número do cartão). */
  cardToken: optionalText(500),
  cardPaymentMethodId: optionalText(40),
  cardIssuerId: optionalText(40),
  customer: z.object({ cpf: cpfSchema, phone: phoneSchema }),
  customerNote: optionalText(500),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export const checkoutIdSchema = z.object({ checkoutId: z.string().min(1).max(64) });
