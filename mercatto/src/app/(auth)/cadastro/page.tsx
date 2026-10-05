import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { safeRedirectPath } from "@/features/auth/schemas";
import { RegisterForm } from "@/features/auth/components/auth-forms";
import { privateMetadata } from "@/features/seo/metadata";

export const metadata: Metadata = privateMetadata("Criar conta");

type Props = { searchParams: Promise<{ redirect?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const { redirect: to } = await searchParams;
  if (await getCurrentUser()) redirect(safeRedirectPath(to, "/minha-conta"));
  return (
    <div className="rounded-panel border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Crie sua conta</h1>
      <p className="mt-1 mb-6 text-sm text-fg-muted">É rápido e grátis. Compre com PIX, cartão e acompanhe tudo em um só lugar.</p>
      <RegisterForm redirect={to ? safeRedirectPath(to) : undefined} />
      <p className="mt-6 text-center text-sm text-fg-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-brand-700 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
