import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';
import { siteConfig } from '@/config/site';
import { formatPrice } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: `Conditions for orders placed through the ${siteConfig.name} website.`,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  const { delivery } = siteConfig;
  return (
    <LegalPage title="Terms of use" updatedAt="October 2026">
      <p>By using this website to place an order, you agree to the conditions below.</p>
      <h2>Orders</h2>
      <ul>
        <li>An order is only confirmed once the pizzeria replies on WhatsApp.</li>
        <li>Prices, flavors and availability may change without notice. If anything differs, we will let you know before confirming.</li>
        <li>Half &amp; half pizzas are charged at the price of the more expensive flavor.</li>
        {delivery.minimumOrder > 0 && <li>Minimum order: {formatPrice(delivery.minimumOrder)}.</li>}
      </ul>
      <h2>Delivery and pickup</h2>
      <ul>
        <li>
          Average delivery time: {delivery.estimate}. Pickup: {delivery.pickupEstimate}. Times may vary during peak
          hours.
        </li>
        <li>
          Delivery fee of {formatPrice(delivery.fee)}
          {delivery.freeFrom !== null && `, free on orders of ${formatPrice(delivery.freeFrom)} or more`}. The fee may
          vary by area, and we confirm it on WhatsApp.
        </li>
      </ul>
      <h2>Payment</h2>
      <p>Payment is made on delivery or at pickup, by Pix, card or cash.</p>
      <h2>Cancellations</h2>
      <p>Orders can be cancelled at no cost before they go into preparation. Just message us on WhatsApp.</p>
    </LegalPage>
  );
}
