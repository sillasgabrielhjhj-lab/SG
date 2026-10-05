import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { safeRedirectPath } from "@/features/auth/schemas";
import { LoginForm } from "@/features/auth/components/auth-forms";
import { privateMetadata } from "@/features/seo/metadata";

export const metadata: Metadata = privateMetadata("Entrar");

type Props = { searchParams: Promise<{ redirect?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { redirect: to } = await searchParams;
  const safe = safeRedirectPath(to, "/");
  if (await getCurrentUser()) redirect(safe);
  return (
    <div className="rounded-panel border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Entre na sua conta</h1>
      <p className="mt-1 mb-6 text-sm text-fg-muted">Acompanhe pedidos, salve favoritos e compre mais rápido.</p>
      <LoginForm redirect={safe} />
      <p className="mt-6 text-center text-sm text-fg-muted">
        Novo na Mercatto?{" "}
        <Link href={`/cadastro${to ? `?redirect=${encodeURIComponent(safe)}` : ""}`} className="font-semibold text-brand-700 hover:underline">
          Crie sua conta
        </Link>
      </p>
    </div>
  );
}
