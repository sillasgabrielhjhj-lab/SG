import type { Metadata } from "next";
import Link from "next/link";
import { Package, DollarSign, ShoppingBag, Star, Plus } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";
import { getSellerByUserId, getSellerOverview } from "@/lib/data/seller";
import { formatCurrencyBRL } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BecomeSellerForm } from "@/app/vendedor/become-seller-form";

export const metadata: Metadata = { title: "Painel do vendedor" };

export default async function SellerDashboardPage() {
  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);

  if (!seller) {
    return <BecomeSellerForm />;
  }

  const overview = await getSellerOverview(seller.id);

  const stats = [
    { label: "Receita total", value: formatCurrencyBRL(overview.revenueCents), icon: DollarSign },
    { label: "Produtos vendidos", value: overview.salesCount, icon: ShoppingBag },
    { label: "Produtos ativos", value: `${overview.activeProductCount}/${overview.productCount}`, icon: Package },
    { label: "Avaliações recebidas", value: overview.reviewCount, icon: Star },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Bem-vindo(a) de volta, {seller.storeName}.</p>
        </div>
        <Button asChild>
          <Link href="/vendedor/produtos/novo">
            <Plus className="size-4" /> Novo produto
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {overview.pendingOrderItems > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-5">
            <p className="text-sm text-foreground">
              Você tem <span className="font-semibold">{overview.pendingOrderItems}</span> itens de pedidos
              aguardando envio.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/vendedor/pedidos">Ver pedidos</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
