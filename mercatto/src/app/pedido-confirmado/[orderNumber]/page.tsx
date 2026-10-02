import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { requireUser } from "@/lib/auth/guards";
import { getOrderDetail } from "@/lib/data/orders";
import { ConfirmationStep } from "@/components/checkout/steps/confirmation-step";

type Props = { params: Promise<{ orderNumber: string }> };

export const metadata: Metadata = { title: "Pedido confirmado" };

export default async function OrderConfirmedPage({ params }: Props) {
  const { orderNumber } = await params;
  const user = await requireUser();

  const order = await getOrderDetail(user.id, orderNumber);
  if (!order) notFound();

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container-page max-w-3xl py-6">
          <ConfirmationStep orderNumber={order.orderNumber} totalCents={order.totalCents} />
        </div>
      </main>
      <Footer />
    </>
  );
}
