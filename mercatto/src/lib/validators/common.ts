import { z } from "zod";

/** Converte strings vazias/whitespace em undefined antes de validar. */
export const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Texto opcional: "" vira undefined; aplica trim e limite. */
export const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/** Envolve um schema tornando-o opcional quando vazio. */
export const optionalField = <S extends z.ZodType>(schema: S) => z.preprocess(emptyToUndefined, schema.optional());

/** Checkbox de formulário ("on"/"true") -> boolean. */
export const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());

/** Inteiro a partir de string de formulário. */
export const intField = (opts: { min?: number; max?: number } = {}) =>
  z.coerce
    .number({ error: "Informe um número" })
    .int("Use um número inteiro")
    .min(opts.min ?? Number.MIN_SAFE_INTEGER)
    .max(opts.max ?? Number.MAX_SAFE_INTEGER);

export const idSchema = z.string().trim().min(1).max(64);

export const emailSchema = z.string().trim().toLowerCase().max(254).email("E-mail inválido");

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .max(128, "Senha muito longa")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e números");
