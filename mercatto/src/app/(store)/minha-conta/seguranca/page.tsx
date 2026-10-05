import { ShieldCheck } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { listSessions } from "@/features/account/service";
import { ChangePasswordForm, SessionList } from "@/features/account/components/account-forms";
import { ResendVerificationButton } from "@/features/account/components/resend-verification";
import { PageHeading } from "@/components/layout/page-heading";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Segurança" };

export default async function SecurityPage() {
  const user = await requireUserPage("/minha-conta/seguranca");
  const [session, sessions] = await Promise.all([getSession(), listSessions(user.id)]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Segurança" description="Gerencie sua senha e os dispositivos conectados." />
      {user.emailVerifiedAt ? (
        <p className="flex items-center gap-2 text-sm text-success-700">
          <ShieldCheck className="size-4" aria-hidden /> E-mail {user.email} confirmado.
        </p>
      ) : (
        <Alert tone="warning" title="E-mail não confirmado" action={<ResendVerificationButton />}>
          Confirme seu e-mail para proteger a conta e recuperar o acesso quando precisar.
        </Alert>
      )}
      <section aria-labelledby="pw-title" className="rounded-card border border-line bg-surface p-4 sm:p-6">
        <h2 id="pw-title" className="mb-1 font-bold">
          Alterar senha
        </h2>
        <p className="mb-4 text-sm text-fg-muted">Ao alterar a senha, as outras sessões abertas são encerradas.</p>
        <ChangePasswordForm />
      </section>
      <section aria-labelledby="sessions-title" className="rounded-card border border-line bg-surface p-4 sm:p-6">
        <h2 id="sessions-title" className="mb-1 font-bold">
          Sessões ativas
        </h2>
        <p className="mb-4 text-sm text-fg-muted">Se não reconhecer algum acesso, encerre a sessão e altere sua senha.</p>
        <SessionList sessions={sessions.map((s) => ({ id: s.id, current: s.id === session?.sessionId, createdAt: s.createdAt.toISOString(), lastUsedAt: s.lastUsedAt.toISOString(), ipAddress: s.ipAddress, userAgent: s.userAgent }))} />
      </section>
    </div>
  );
}
