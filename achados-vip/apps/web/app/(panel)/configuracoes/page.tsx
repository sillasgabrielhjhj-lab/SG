import type { Metadata } from 'next';
import { SettingsView } from '@/views/settings-view';

export const metadata: Metadata = { title: 'Configurações' };

export default function Page() {
  return <SettingsView />;
}
