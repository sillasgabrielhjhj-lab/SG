import "server-only";
import { z } from "zod";
import { resolveAppUrl } from "@/lib/app-url";

/**
 * Variáveis de ambiente validadas na inicialização.
 * Nunca importar este módulo em componentes client.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve ter pelo menos 32 caracteres"),

  PAYMENT_PROVIDER: z.enum(["dev", "mercadopago"]).default("dev"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).optional(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),

  SHIPPING_PROVIDER: z.enum(["table", "melhorenvio"]).default("table"),
  MELHORENVIO_TOKEN: z.string().optional(),

  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Mercatto <nao-responda@mercatto.local>"),

  STORAGE_PROVIDER: z.enum(["local", "vercel-blob"]).default("local"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  CEP_PROVIDER: z.enum(["viacep", "none"]).default("viacep"),

  CRON_SECRET: z.string().min(16).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse({ ...process.env, APP_URL: resolveAppUrl() });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (env.AUTH_SECRET.startsWith("dev-only")) {
      throw new Error("AUTH_SECRET de desenvolvimento não pode ser usado em produção.");
    }
  }
  return env;
}

export const env = load();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
