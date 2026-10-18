import type { Metadata } from 'next';
import { AutomationView } from '@/views/automation-view';

export const metadata: Metadata = { title: 'Automação' };

export default function Page() {
  return <AutomationView />;
}
