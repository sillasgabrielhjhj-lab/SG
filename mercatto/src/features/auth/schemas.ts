import { z } from "zod";
import { cpfSchema, phoneSchema } from "@/lib/validators/br";
import { checkbox, emailSchema, optionalField, passwordSchema } from "@/lib/validators/common";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha").max(128),
  redirect: z.string().max(500).optional(),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(3, "Informe seu nome completo").max(120),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    cpf: optionalField(cpfSchema),
    phone: optionalField(phoneSchema),
    acceptTerms: checkbox.refine((v) => v, "Você precisa aceitar os Termos de Uso e a Política de Privacidade"),
    marketingOptIn: checkbox.optional(),
    redirect: z.string().max(500).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem" });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem" });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual").max(128),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem" });

/** Aceita apenas caminhos internos ("/x"), bloqueando open redirect ("//evil", "https://..."). */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}
