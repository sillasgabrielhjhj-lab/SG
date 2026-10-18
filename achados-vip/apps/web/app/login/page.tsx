import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginView } from '@/views/login-view';

export const metadata: Metadata = { title: 'Entrar' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}
