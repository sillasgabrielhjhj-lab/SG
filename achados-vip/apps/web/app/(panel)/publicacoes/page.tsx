import type { Metadata } from 'next';
import { PublicationsView } from '@/views/publications-view';

export const metadata: Metadata = { title: 'Publicações' };

export default function Page() {
  return <PublicationsView />;
}
