'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="conteudo" role="alert" className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-semibold">Algo deu errado ao exibir esta página.</p>
      <p className="max-w-md text-sm text-muted">Recarregue a página. Se o problema persistir, consulte os logs em Configurações.</p>
      <Button variant="primary" onClick={reset}>
        Tentar novamente
      </Button>
    </main>
  );
}
