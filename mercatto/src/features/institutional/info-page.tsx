import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export type InfoSection = { id: string; title: string; body: ReactNode };

/** Página institucional/legal com sumário navegável e tipografia de leitura. */
export function InfoPage({ title, intro, updatedAt, legalDraft, sections, aside }: { title: string; intro?: ReactNode; updatedAt?: string; legalDraft?: boolean; sections: InfoSection[]; aside?: ReactNode }) {
  return (
    <div className="container-page py-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: title }]} />
      <div className="mt-4 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label="Nesta página" className="sticky top-28 flex flex-col gap-1 border-l border-line pl-4 text-sm">
            <p className="mb-1 text-2xs font-bold tracking-wider text-fg-subtle uppercase">Nesta página</p>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="py-1 text-fg-muted hover:text-brand-800">
                {s.title}
              </a>
            ))}
          </nav>
          {aside}
        </aside>
        <article className="max-w-3xl">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {updatedAt ? <p className="mt-1 text-sm text-fg-subtle">Última atualização: {updatedAt}</p> : null}
          {legalDraft ? (
            <div role="note" className="mt-4 flex gap-3 rounded-card border border-warning-600/30 bg-warning-50 p-4 text-sm text-warning-700">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p>
                <strong>Modelo para referência — requer revisão jurídica antes da publicação.</strong> Os campos entre colchetes (ex.: [RAZÃO SOCIAL], [CNPJ], [ENDEREÇO]) devem ser preenchidos com os dados reais da empresa.
              </p>
            </div>
          ) : null}
          {intro ? <div className="mt-4 text-base leading-relaxed text-fg-muted">{intro}</div> : null}
          <div className="mt-8 flex flex-col gap-8">
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-28">
                <h2 id={`${s.id}-t`} className="mb-2 text-lg font-bold">
                  {s.title}
                </h2>
                <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-fg-muted [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc [&_strong]:text-fg [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline">{s.body}</div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
