import { z } from "zod";
import { cpfSchema, phoneSchema } from "@/lib/validators/br";
import { checkbox, optionalField } from "@/lib/validators/common";

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(120),
  cpf: optionalField(cpfSchema),
  phone: optionalField(phoneSchema),
  birthDate: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce
      .date({ error: "Data inválida" })
      .refine((d) => d < new Date() && d > new Date("1900-01-01"), "Data inválida")
      .optional(),
  ),
  marketingOptIn: checkbox.default(false),
});

export type ProfileInput = z.infer<typeof profileSchema>;
