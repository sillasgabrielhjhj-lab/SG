import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Verificação de e-mail" };

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyEmailToken(token);

  return (
    <AuthShell title="Verificação de e-mail">
      {result.success ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <p className="text-sm text-muted-foreground">
            E-mail confirmado com sucesso! Sua conta está totalmente ativa.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href="/">Ir para a Mercatto</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <XCircle className="size-12 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Este link de verificação é inválido ou já expirou.
          </p>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link href="/">Voltar para a Mercatto</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
