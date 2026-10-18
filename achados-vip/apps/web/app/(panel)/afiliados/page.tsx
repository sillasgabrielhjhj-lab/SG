import type { Metadata } from 'next';
import { AffiliatesView } from '@/views/affiliates-view';

export const metadata: Metadata = { title: 'Afiliados' };

export default function Page() {
  return <AffiliatesView />;
}
