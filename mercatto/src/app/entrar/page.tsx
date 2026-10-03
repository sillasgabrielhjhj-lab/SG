import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/app/entrar/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Entrar na sua conta"
      description="Acesse para acompanhar pedidos, favoritos e muito mais."
      footer={
        <span className="text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </span>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
