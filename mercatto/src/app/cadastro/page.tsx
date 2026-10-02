import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/app/cadastro/register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Criar sua conta"
      description="Leva menos de um minuto."
      footer={
        <span className="text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </span>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
