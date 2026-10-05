import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/components/auth-forms";
import { privateMetadata } from "@/features/seo/metadata";

export const metadata: Metadata = privateMetadata("Recuperar senha");

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-panel border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Recuperar senha</h1>
      <p className="mt-1 mb-6 text-sm text-fg-muted">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
      <ForgotPasswordForm />
    </div>
  );
}
