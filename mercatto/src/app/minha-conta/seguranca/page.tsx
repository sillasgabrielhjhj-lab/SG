import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Monitor, ShieldX } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { revokeSessionAction } from "@/lib/actions/account";
import { ChangePasswordForm } from "@/app/minha-conta/seguranca/change-password-form";

export const metadata: Metadata = { title: "Segurança" };

export default async function SecurityPage() {
  const user = await requireUser();

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(process.env.SESSION_COOKIE_NAME ?? "mercatto_session")?.value;
  const currentTokenHash = rawToken ? hashToken(rawToken) : null;

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Segurança</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie sua senha e os dispositivos conectados à sua conta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessões ativas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pb-5">
          {sessions.map((session) => {
            const isCurrent = session.tokenHash === currentTokenHash;
            const revokeWithId = revokeSessionAction.bind(null, session.id);
            return (
              <div
                key={session.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="size-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {session.userAgent?.slice(0, 60) ?? "Dispositivo desconhecido"}
                      </p>
                      {isCurrent && <Badge variant="success">Este dispositivo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      IP {session.ipAddress ?? "desconhecido"} · desde{" "}
                      {session.createdAt.toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                {!isCurrent && (
                  <form action={revokeWithId}>
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                      <ShieldX className="size-3.5" /> Encerrar
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
