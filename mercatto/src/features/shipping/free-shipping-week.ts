/**
 * Semana do frete grátis: entrega grátis em TODO o site (todas as lojas e
 * produtos) dentro da janela abaixo, no horário de Brasília. Vale no servidor
 * (cotação, carrinho e checkout) — a vitrine só anuncia o que o checkout cobra.
 * Para encerrar antes ou mudar o período, edite as datas e o texto do prazo.
 */
export const FREE_SHIPPING_WEEK = {
  startsAt: new Date("2026-10-11T00:00:00-03:00"),
  endsAt: new Date("2026-10-18T23:59:59-03:00"),
  /** Prazo exibido na vitrine. */
  endsLabel: "domingo, 18/10, às 23h59",
} as const;

export function isFreeShippingWeek(now: Date = new Date()): boolean {
  return now >= FREE_SHIPPING_WEEK.startsAt && now <= FREE_SHIPPING_WEEK.endsAt;
}
