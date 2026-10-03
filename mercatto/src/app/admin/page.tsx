import type { Metadata } from "next";
import { Users, Store, Package, ShoppingBag, DollarSign, Clock } from "lucide-react";

import { getAdminOverview } from "@/lib/data/admin";
import { formatCurrencyBRL } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Painel administrativo" };

export default async function AdminDashboardPage() {
  const overview = await getAdminOverview();

  const stats = [
    { label: "Receita total", value: formatCurrencyBRL(overview.revenueCents), icon: DollarSign },
    { label: "Pedidos", value: overview.orderCount, icon: ShoppingBag },
    { label: "Usuários", value: overview.userCount, icon: Users },
    { label: "Vendedores", value: overview.sellerCount, icon: Store },
    { label: "Produtos", value: overview.productCount, icon: Package },
    { label: "Aguardando pagamento", value: overview.pendingOrders, icon: Clock },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Visão geral</h1>
        <p className="text-sm text-muted-foreground">Resumo da plataforma.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col gap-1 py-5">
              <stat.icon className="size-5 text-primary" />
              <p className="font-display text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
