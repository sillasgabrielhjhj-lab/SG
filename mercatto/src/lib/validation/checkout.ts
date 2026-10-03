import { z } from "zod";

export const placeOrderSchema = z.object({
  addressId: z.string().uuid(),
  shippingOptionId: z.enum(["standard", "express"]),
  paymentMethod: z.enum(["CREDIT_CARD", "PIX", "BOLETO"]),
  installments: z.coerce.number().int().min(1).max(12).default(1),
  cardNumber: z.string().optional(),
  cardName: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
});
