import { MapPin, Star, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteAddressAction, setDefaultAddressAction } from "@/lib/actions/account";

type Address = {
  id: string;
  label: string | null;
  recipientName: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
};

export function AddressCard({ address }: { address: Address }) {
  const deleteWithId = deleteAddressAction.bind(null, address.id);
  const setDefaultWithId = setDefaultAddressAction.bind(null, address.id);

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-5">
        <div className="flex gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">
                {address.label || "Endereço"}
              </p>
              {address.isDefault && <Badge variant="success">Principal</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{address.recipientName}</p>
            <p className="text-sm text-muted-foreground">
              {address.street}, {address.number}
              {address.complement ? ` — ${address.complement}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {address.neighborhood}, {address.city} - {address.state}
            </p>
            <p className="text-sm text-muted-foreground">CEP {address.zipCode}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {!address.isDefault && (
            <form action={setDefaultWithId}>
              <Button type="submit" variant="outline" size="sm">
                <Star className="size-3.5" /> Tornar principal
              </Button>
            </form>
          )}
          <form action={deleteWithId}>
            <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
              <Trash2 className="size-3.5" /> Remover
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
