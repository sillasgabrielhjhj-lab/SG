'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream-50 px-6 text-center">
      <h1 className="text-display text-3xl sm:text-4xl">Oops, something went wrong.</h1>
      <p className="mt-3 max-w-sm text-ink-500">Please try again. If the problem persists, place your order over WhatsApp.</p>
      <Button size="lg" className="mt-8" onClick={reset}>
        <RotateCcw className="size-4" aria-hidden /> Try again
      </Button>
    </main>
  );
}
