import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmailToken } from "@/features/auth/service";
import { privateMetadata } from "@/features/seo/metadata";

export const metadata: Metadata = privateMetadata("Confirmar e-mail");

type Props = { searchParams: Promise<{ token?: string }> };

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const ok = token && token.length >= 20 && token.length <= 200 ? await verifyEmailToken(token) : false;
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface p-8 text-center shadow-card">
      {ok ? <CheckCircle2 className="size-12 text-success-600" aria-hidden /> : <XCircle className="size-12 text-danger-600" aria-hidden />}
      <h1 className="text-xl font-extrabold">{ok ? "E-mail confirmado!" : "Não foi possível confirmar"}</h1>
      <p className="text-sm text-fg-muted">{ok ? "Obrigado! Sua conta está protegida e você receberá as atualizações dos pedidos." : "O link é inválido, já foi usado ou expirou. Você pode pedir um novo na área Minha conta."}</p>
      <Link href="/minha-conta" className="text-sm font-semibold text-brand-700 hover:underline">
        Ir para Minha conta
      </Link>
    </div>
  );
}
