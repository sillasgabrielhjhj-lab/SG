import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/guards";
import { getAdminUsers } from "@/lib/data/admin";
import { Badge } from "@/components/ui/badge";
import { RoleSelect } from "@/components/admin/role-select";

export const metadata: Metadata = { title: "Usuários" };

export default async function AdminUsersPage() {
  const currentUser = await requireUser();
  const users = await getAdminUsers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-sm text-muted-foreground">{users.length} usuários cadastrados</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border px-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Nome</th>
              <th className="py-3 pr-4 font-medium">E-mail</th>
              <th className="py-3 pr-4 font-medium">Verificado</th>
              <th className="py-3 pr-4 font-medium">Desde</th>
              <th className="py-3 font-medium">Papel</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 text-sm text-foreground">{user.name}</td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">{user.email}</td>
                <td className="py-3 pr-4">
                  {user.emailVerified ? (
                    <Badge variant="success">Sim</Badge>
                  ) : (
                    <Badge variant="secondary">Não</Badge>
                  )}
                </td>
                <td className="py-3 pr-4 text-sm text-muted-foreground">
                  {user.createdAt.toLocaleDateString("pt-BR")}
                </td>
                <td className="py-3">
                  <RoleSelect userId={user.id} currentRole={user.role} disabled={user.id === currentUser.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
