import type { Metadata } from "next";
import { BadgeCheck, BadgeAlert } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import { ProfileForm } from "@/app/minha-conta/profile-form";

export const metadata: Metadata = { title: "Meus dados" };

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Meus dados</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas informações pessoais.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Informações pessoais</CardTitle>
          {user.emailVerified ? (
            <Badge variant="success">
              <BadgeCheck /> E-mail verificado
            </Badge>
          ) : (
            <Badge variant="warning">
              <BadgeAlert /> E-mail não verificado
            </Badge>
          )}
        </CardHeader>
        <CardContent className="pb-5">
          <p className="mb-4 text-sm text-muted-foreground">{user.email}</p>
          <ProfileForm defaultName={user.name} defaultPhone={user.phone ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
