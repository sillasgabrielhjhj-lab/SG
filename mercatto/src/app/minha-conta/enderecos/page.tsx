import type { Metadata } from "next";
import { MapPin } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { AddressFormDialog } from "@/app/minha-conta/enderecos/address-form-dialog";
import { AddressCard } from "@/app/minha-conta/enderecos/address-card";

export const metadata: Metadata = { title: "Endereços" };

export default async function AddressesPage() {
  const user = await requireUser();

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Endereços</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus endereços de entrega.
          </p>
        </div>
        <AddressFormDialog />
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <MapPin className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Você ainda não cadastrou nenhum endereço.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {addresses.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </div>
      )}
    </div>
  );
}
