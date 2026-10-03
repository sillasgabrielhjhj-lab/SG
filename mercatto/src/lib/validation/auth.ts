import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo").max(120),
  email: z.email("E-mail inválido").max(190),
  password: z
    .string()
    .min(8, "A senha precisa ter no mínimo 8 caracteres")
    .max(72)
    .regex(/[a-z]/, "A senha precisa ter uma letra minúscula")
    .regex(/[A-Z]/, "A senha precisa ter uma letra maiúscula")
    .regex(/[0-9]/, "A senha precisa ter um número"),
});

export const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export const requestPasswordResetSchema = z.object({
  email: z.email("E-mail inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "A senha precisa ter no mínimo 8 caracteres")
    .max(72)
    .regex(/[a-z]/, "A senha precisa ter uma letra minúscula")
    .regex(/[A-Z]/, "A senha precisa ter uma letra maiúscula")
    .regex(/[0-9]/, "A senha precisa ter um número"),
});
