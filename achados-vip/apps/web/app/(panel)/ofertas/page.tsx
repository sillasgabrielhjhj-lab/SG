import type { Metadata } from 'next';
import { OffersView } from '@/views/offers-view';

export const metadata: Metadata = { title: 'Ofertas' };

export default function Page() {
  return <OffersView />;
}
