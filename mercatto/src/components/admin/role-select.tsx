"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateUserRoleAction } from "@/lib/actions/admin";

export function RoleSelect({ userId, currentRole, disabled }: { userId: string; currentRole: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={currentRole}
      disabled={disabled || isPending}
      onChange={(e) => {
        startTransition(async () => {
          await updateUserRoleAction(userId, e.target.value);
          router.refresh();
        });
      }}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground disabled:opacity-50"
    >
      <option value="USER">USER</option>
      <option value="SELLER">SELLER</option>
      <option value="ADMIN">ADMIN</option>
    </select>
  );
}
