import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { siteConfig } from '@/config/site';
import { formatPrice } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Termos de uso',
  description: `Condições para pedidos feitos pelo site da ${siteConfig.name}.`,
  alternates: { canonical: '/termos' },
};

export default function TermsPage() {
  const { delivery } = siteConfig;
  return (
    <LegalPage title="Termos de uso" updatedAt="outubro de 2026">
      <p>Ao usar este site para montar um pedido, você concorda com as condições abaixo.</p>
      <h2>Pedidos</h2>
      <ul>
        <li>O pedido só é considerado confirmado após a resposta da pizzaria no WhatsApp.</li>
        <li>Preços, sabores e disponibilidade podem mudar sem aviso prévio. Em caso de divergência, informaremos antes de confirmar.</li>
        <li>Pizzas meio a meio são cobradas pelo valor do sabor mais caro.</li>
        {delivery.minimumOrder > 0 && <li>Pedido mínimo de {formatPrice(delivery.minimumOrder)}.</li>}
      </ul>
      <h2>Entrega e retirada</h2>
      <ul>
        <li>Tempo médio de entrega: {delivery.estimate}. Para retirada: {delivery.pickupEstimate}. Os prazos podem variar em horários de pico.</li>
        <li>
          Taxa de entrega de {formatPrice(delivery.fee)}
          {delivery.freeFrom !== null && `, grátis em pedidos a partir de ${formatPrice(delivery.freeFrom)}`}. A taxa pode
          variar conforme a região, e confirmamos o valor no WhatsApp.
        </li>
      </ul>
      <h2>Pagamento</h2>
      <p>O pagamento é feito na entrega ou na retirada, por Pix, cartão ou dinheiro.</p>
      <h2>Cancelamentos</h2>
      <p>Pedidos podem ser cancelados sem custo antes de entrarem em preparo. Fale conosco pelo WhatsApp.</p>
    </LegalPage>
  );
}
