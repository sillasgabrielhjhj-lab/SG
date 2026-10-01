import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/logo';
import { siteConfig } from '@/config/site';

export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream-50">
      <header className="border-b border-ink-900/[0.06] bg-ink-950">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" aria-label={`${siteConfig.name} — página inicial`}>
            <Logo className="h-10" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cream-50/80 hover:text-cream-50">
            <ArrowLeft className="size-4" aria-hidden /> Voltar ao site
          </Link>
        </div>
      </header>
      <main className="container-page max-w-3xl py-14 lg:py-20">
        <h1 className="text-display text-4xl font-medium sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-500">Última atualização: {updatedAt}</p>
        <div className="mt-10 space-y-5 leading-relaxed text-ink-700 [&_h2]:text-display [&_h2]:pt-4 [&_h2]:text-2xl [&_h2]:text-ink-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
        <p className="mt-12 rounded-2xl bg-gold-300/25 px-5 py-4 text-sm text-[#6b4a0e]">
          Modelo de texto. Revise com a pizzaria (e, se possível, com um profissional jurídico) antes de publicar.
        </p>
      </main>
    </div>
  );
}
