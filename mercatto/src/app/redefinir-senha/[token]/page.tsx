import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/app/redefinir-senha/[token]/reset-form";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthShell title="Redefinir senha" description="Escolha uma nova senha para sua conta.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
