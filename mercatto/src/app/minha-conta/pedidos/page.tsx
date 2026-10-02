import type { Metadata } from "next";
import { Package } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function OrdersPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Meus pedidos</h1>
        <p className="text-sm text-muted-foreground">Acompanhe suas compras.</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
        <Package className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Você ainda não fez nenhum pedido.
        </p>
      </div>
    </div>
  );
}
