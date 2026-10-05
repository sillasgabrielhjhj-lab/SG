import type { Metadata } from "next";
import Link from "next/link";
import { isPasswordResetTokenValid } from "@/features/auth/service";
import { ResetPasswordForm } from "@/features/auth/components/auth-forms";
import { privateMetadata } from "@/features/seo/metadata";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = privateMetadata("Redefinir senha");

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const valid = token && token.length >= 20 && token.length <= 200 ? await isPasswordResetTokenValid(token) : false;
  return (
    <div className="rounded-panel border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Criar nova senha</h1>
      {valid && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="danger" title="Link inválido ou expirado">
          Solicite um novo link em <Link href="/recuperar-senha">Recuperar senha</Link>.
        </Alert>
      )}
    </div>
  );
}
