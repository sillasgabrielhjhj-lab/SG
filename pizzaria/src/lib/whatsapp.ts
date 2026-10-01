import { siteConfig } from '@/config/site';
import type { CheckoutData, PaymentMethod } from '@/types/cart';
import { formatCents, onlyDigits, parseMoneyInput, toCents } from './format';
import type { CartTotals, ResolvedCartItem } from './pricing';

export const paymentLabels: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credito: 'Credit card',
  debito: 'Debit card',
  dinheiro: 'Cash',
};

/** Link para conversar com a pizzaria (com mensagem opcional). */
export function whatsappLink(message?: string): string {
  const phone = onlyDigits(siteConfig.contact.whatsapp);
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${phone}${text}`;
}

/** Código curto do pedido, fácil de falar ao telefone (ex.: "K7Q2"). */
export function createOrderCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

interface OrderMessageInput {
  code: string;
  lines: ResolvedCartItem[];
  totals: CartTotals;
  checkout: CheckoutData;
  date?: Date;
}

/**
 * Monta a mensagem do pedido no formato do WhatsApp
 * (*negrito*, _itálico_ e quebras de linha).
 */
export function buildOrderMessage({ code, lines, totals, checkout, date = new Date() }: OrderMessageInput): string {
  const when = new Intl.DateTimeFormat(siteConfig.locale, {
    timeZone: siteConfig.timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  const out: string[] = [];
  out.push(`*NEW ORDER #${code}*`);
  out.push(`${siteConfig.name} · ${when}`);
  out.push('');

  out.push('*ITEMS*');
  for (const line of lines) {
    const size = line.sizeLabel ? ` (${line.sizeLabel.split(' · ')[0]})` : '';
    const name = line.halfProduct
      ? `Half & half pizza${size}`
      : `${line.product.name}${size}`;
    out.push(`${line.item.quantity}x ${name} — ${formatCents(line.totalCents)}`);
    if (line.halfProduct) {
      out.push(`   • ½ ${line.product.name} + ½ ${line.halfProduct.name}`);
    }
    for (const detail of line.details) out.push(`   • ${detail}`);
    if (line.item.notes?.trim()) out.push(`   • Note: ${line.item.notes.trim()}`);
    if (line.item.quantity > 1) out.push(`   _${formatCents(line.unitCents)} each_`);
  }
  out.push('');

  out.push('*SUMMARY*');
  out.push(`Subtotal: ${formatCents(totals.subtotalCents)}`);
  if (checkout.mode === 'delivery') {
    out.push(`Delivery: ${totals.deliveryFeeCents === 0 ? 'Free' : formatCents(totals.deliveryFeeCents)}`);
  }
  out.push(`*Total: ${formatCents(totals.totalCents)}*`);
  out.push('');

  out.push('*CUSTOMER*');
  out.push(`Name: ${checkout.name.trim()}`);
  out.push(`Phone: ${checkout.phone.trim()}`);
  out.push('');

  if (checkout.mode === 'delivery') {
    const a = checkout.address;
    out.push('*DELIVERY*');
    out.push(`${a.street.trim()}, ${a.number.trim()}${a.complement.trim() ? ` — ${a.complement.trim()}` : ''}`);
    out.push(`${a.neighborhood.trim()}${a.city.trim() ? ` · ${a.city.trim()}` : ''}`);
    if (a.cep.trim()) out.push(`Postal code: ${a.cep.trim()}`);
    if (a.reference.trim()) out.push(`Landmark: ${a.reference.trim()}`);
  } else {
    out.push('*PICKUP*');
    out.push(`${siteConfig.address.street} — ${siteConfig.address.neighborhood}`);
  }
  out.push('');

  out.push('*PAYMENT*');
  let payment = paymentLabels[checkout.payment];
  if (checkout.payment === 'dinheiro') {
    const change = parseMoneyInput(checkout.changeFor);
    payment += change && toCents(change) > totals.totalCents ? ` — change for ${formatCents(toCents(change))}` : ' — no change needed';
  }
  if (checkout.payment === 'credito' || checkout.payment === 'debito') {
    payment += checkout.mode === 'delivery' ? ' (card machine on delivery)' : ' (at pickup)';
  }
  out.push(payment);

  if (checkout.notes.trim()) {
    out.push('');
    out.push('*NOTES*');
    out.push(checkout.notes.trim());
  }

  return out.join('\n');
}
