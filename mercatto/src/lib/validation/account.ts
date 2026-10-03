import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual"),
    newPassword: z
      .string()
      .min(8, "A nova senha precisa ter no mínimo 8 caracteres")
      .max(72)
      .regex(/[a-z]/, "A senha precisa ter uma letra minúscula")
      .regex(/[A-Z]/, "A senha precisa ter uma letra maiúscula")
      .regex(/[0-9]/, "A senha precisa ter um número"),
  });

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal("")),
  recipientName: z.string().trim().min(2, "Informe o nome do destinatário").max(120),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
  street: z.string().trim().min(2, "Informe a rua").max(160),
  number: z.string().trim().min(1, "Informe o número").max(20),
  complement: z.string().trim().max(80).optional().or(z.literal("")),
  neighborhood: z.string().trim().min(2, "Informe o bairro").max(100),
  city: z.string().trim().min(2, "Informe a cidade").max(100),
  state: z
    .string()
    .trim()
    .length(2, "Use a sigla do estado (ex: PE)")
    .toUpperCase(),
  isDefault: z.coerce.boolean().optional(),
});
