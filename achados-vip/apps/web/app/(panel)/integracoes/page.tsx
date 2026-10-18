import type { Metadata } from 'next';
import { IntegrationsView } from '@/views/integrations-view';

export const metadata: Metadata = { title: 'Integrações' };

export default function Page() {
  return <IntegrationsView />;
}
