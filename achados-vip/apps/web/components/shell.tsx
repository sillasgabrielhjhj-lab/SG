'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useFetch } from '@/lib/use-fetch';

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/ofertas', label: 'Ofertas', icon: 'tag' },
  { href: '/afiliados', label: 'Afiliados', icon: 'link' },
  { href: '/publicacoes', label: 'Publicações', icon: 'send' },
  { href: '/automacao', label: 'Automação', icon: 'sliders' },
  { href: '/integracoes', label: 'Integrações', icon: 'plug' },
  { href: '/configuracoes', label: 'Configurações', icon: 'cog' },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const notifs = useFetch('shell-notifications', (s) => api.notifications(s), { intervalMs: 60_000 });
  const unread = notifs.data?.filter((n) => !n.read).length ?? 0;

  // Fecha o menu móvel ao navegar e com ESC.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="min-h-screen lg:pl-64">
      {open ? <div className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <aside
        id="menu-lateral"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200',
          open ? 'translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-fg" aria-hidden="true">
            <Icon name="tag" size={16} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Achados VIP</p>
            <p className="text-[11px] text-muted">Painel administrativo</p>
          </div>
        </div>
        <nav aria-label="Principal" className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-primary-soft text-primary-ink' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <p className="truncate px-3 text-xs text-muted" title={user?.email}>
            {user?.email}
          </p>
          <p className="px-3 pb-2 text-[11px] text-muted">{user?.role === 'ADMIN' ? 'Administrador' : user?.role === 'VIEWER' ? 'Somente leitura' : user?.role}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => void logout()} icon={<Icon name="logout" size={16} />}>
            Sair
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-6">
        <button
          type="button"
          className="rounded-lg p-2 text-fg hover:bg-surface-2 lg:hidden"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="menu-lateral"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? 'x' : 'menu'} size={20} />
        </button>
        <div className="flex-1" />
        <Link
          href="/configuracoes?tab=alertas"
          className="relative rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label={unread > 0 ? `Alertas: ${unread} não lido(s)` : 'Alertas'}
        >
          <Icon name="bell" size={20} />
          {unread > 0 ? (
            <span className="absolute right-0.5 top-0.5 grid min-h-[1rem] min-w-[1rem] place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white dark:text-slate-950" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>
      </header>

      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-6 outline-none sm:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
