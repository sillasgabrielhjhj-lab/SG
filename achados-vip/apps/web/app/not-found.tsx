import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="conteudo" className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl font-semibold">404</p>
      <p className="text-sm text-muted">Página não encontrada.</p>
      <Link href="/" className={buttonClass('primary')}>
        Voltar ao painel
      </Link>
    </main>
  );
}
