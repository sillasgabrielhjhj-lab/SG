import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { RequestResetForm } from "@/app/recuperar-senha/request-reset-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RequestPasswordResetPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      description="Informe seu e-mail e enviaremos um link para redefinir sua senha."
      footer={
        <Link href="/entrar" className="font-medium text-primary hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <RequestResetForm />
    </AuthShell>
  );
}
