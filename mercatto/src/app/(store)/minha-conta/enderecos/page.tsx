import { requireUserPage } from "@/server/auth/guards";
import { listAddresses } from "@/features/account/service";
import { AddressBook } from "@/features/account/components/address-book";
import { PageHeading } from "@/components/layout/page-heading";

export const metadata = { title: "Endereços" };

export default async function AddressesPage() {
  const user = await requireUserPage("/minha-conta/enderecos");
  const addresses = await listAddresses(user.id);
  return (
    <div>
      <PageHeading title="Endereços" description="Até 10 endereços. O endereço padrão é sugerido no checkout." />
      <AddressBook
        defaultName={user.name}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, recipientName: a.recipientName, phone: a.phone, cep: a.cep, street: a.street, number: a.number, complement: a.complement, district: a.district, city: a.city, state: a.state, reference: a.reference, isDefault: a.isDefault }))}
      />
    </div>
  );
}
