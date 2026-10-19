import type { Metadata } from 'next';
import { QuickView } from '@/views/quick-view';

export const metadata: Metadata = { title: 'Gerar post' };

export default function Page() {
  return <QuickView />;
}
