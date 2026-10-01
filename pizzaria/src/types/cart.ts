/** Escolhas do cliente para um produto (sem preço: o preço é sempre recalculado a partir do cardápio). */
export interface ItemSelection {
  productId: string;
  sizeId?: string;
  /** Segundo sabor quando a pizza é meio a meio. */
  halfProductId?: string;
  /** groupId -> ids das opções escolhidas. */
  options: Record<string, string[]>;
  notes?: string;
}

export interface CartItem extends ItemSelection {
  lineId: string;
  quantity: number;
}

export type FulfillmentMode = 'delivery' | 'pickup';

export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro';

export interface CustomerAddress {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  reference: string;
}

export interface CheckoutData {
  name: string;
  phone: string;
  mode: FulfillmentMode;
  address: CustomerAddress;
  payment: PaymentMethod;
  /** Troco para (em reais), quando pagamento em dinheiro. */
  changeFor: string;
  notes: string;
}
