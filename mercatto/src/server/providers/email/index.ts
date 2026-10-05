import "server-only";
import { env } from "@/server/env";
import { ConsoleEmailProvider } from "@/server/providers/email/console";
import { ResendEmailProvider } from "@/server/providers/email/resend";
import type { EmailProvider } from "@/server/providers/email/types";

let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  instance ??= env.EMAIL_PROVIDER === "resend" ? new ResendEmailProvider(env.RESEND_API_KEY ?? "", env.EMAIL_FROM) : new ConsoleEmailProvider();
  return instance;
}
