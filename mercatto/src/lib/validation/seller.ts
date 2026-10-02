import { z } from "zod";

export const becomeSellerSchema = z.object({
  storeName: z.string().trim().min(3, "Nome da loja muito curto").max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});
