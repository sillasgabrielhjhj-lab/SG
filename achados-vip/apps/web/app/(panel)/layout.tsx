import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';
import { AuthGate } from '@/lib/auth';

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <Shell>{children}</Shell>
    </AuthGate>
  );
}
