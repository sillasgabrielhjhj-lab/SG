import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, FlaskConical } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { ToastProvider } from "@/components/ui/toast";
import { PanelNav, type PanelNavGroup } from "@/components/layout/panel-nav";
import { logoutAction } from "@/features/auth/actions";

/**
 * Estrutura dos painéis (vendedor e administração): barra superior, menu
 * lateral escuro no desktop e faixa de navegação rolável no mobile.
 */
export function DashboardShell({
  title,
  subtitle,
  groups,
  user,
  sandbox,
  publicLink,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  groups: PanelNavGroup[];
  user: { name: string; email: string };
  sandbox?: boolean;
  publicLink?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <a href="#conteudo" className="sr-only z-[60] rounded-md bg-surface px-4 py-2 font-semibold text-brand-800 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden bg-brand-950 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
          <div className="flex h-16 shrink-0 items-center gap-2 px-5">
            <Link href="/" className="rounded-md focus-ring" aria-label="Ir para a loja">
              <Logo tone="inverse" size="sm" />
            </Link>
          </div>
          <div className="px-5 pb-4">
            <p className="text-xs font-bold tracking-wider text-sun-300 uppercase">{title}</p>
            {subtitle ? <div className="mt-0.5 truncate text-sm text-white/80">{subtitle}</div> : null}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <PanelNav groups={groups} label={`Menu — ${title}`} tone="dark" />
          </div>
          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2.5 px-2">
              <Avatar name={user.name} className="size-8 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="truncate text-xs text-white/60">{user.email}</p>
              </div>
            </div>
            <form action={logoutAction} className="mt-2">
              <button type="submit" className="w-full rounded-md px-2 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white focus-ring">
                Sair
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          {sandbox ? (
            <p className="flex items-center justify-center gap-1.5 bg-sun-300 px-4 py-1.5 text-center text-xs font-semibold text-sun-900">
              <FlaskConical className="size-3.5" aria-hidden /> Ambiente de demonstração — pagamentos simulados
            </p>
          ) : null}
          <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3 lg:hidden">
                <Link href="/" className="rounded-md focus-ring" aria-label="Ir para a loja">
                  <Logo variant="mark" size="sm" />
                </Link>
                <span className="truncate text-sm font-bold">{title}</span>
              </div>
              <div className="hidden text-sm text-fg-muted lg:block">{subtitle}</div>
              <div className="flex items-center gap-3">
                {publicLink ? (
                  <Link href={publicLink.href} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                    {publicLink.label} <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
                <Link href="/minha-conta" className="rounded-full focus-ring lg:hidden" aria-label="Minha conta">
                  <Avatar name={user.name} className="size-8 text-xs" />
                </Link>
              </div>
            </div>
            <div className="px-4 pb-2 lg:hidden">
              <PanelNav groups={groups} label={`Menu — ${title}`} />
            </div>
          </header>
          <main id="conteudo" className="flex-1 px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
