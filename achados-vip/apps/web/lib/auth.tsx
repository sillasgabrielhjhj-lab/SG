'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState, Spinner } from '@/components/ui/states';
import { api, onUnauthorized } from './api';
import type { ApiUser } from './types';

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: ApiUser }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: Error };

interface AuthApi {
  state: AuthState;
  user: ApiUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  recheck: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const recheck = useCallback(async () => {
    try {
      const s = await api.me();
      setState({ status: 'authenticated', user: s.user });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) setState({ status: 'unauthenticated' });
      else setState({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) });
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  // 401 em qualquer requisição = sessão perdida → volta ao login.
  useEffect(() => onUnauthorized(() => setState({ status: 'unauthenticated' })), []);

  const login = useCallback(async (email: string, password: string) => {
    const s = await api.login(email, password);
    setState({ status: 'authenticated', user: s.user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* mesmo com falha de rede, encerra a sessão local */
    }
    setState({ status: 'unauthenticated' });
  }, []);

  const value = useMemo<AuthApi>(
    () => ({ state, user: state.status === 'authenticated' ? state.user : null, login, logout, recheck }),
    [state, login, logout, recheck],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Só aceita caminhos internos (evita open redirect via ?next=). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.startsWith('/login')) return '/rapido';
  return next;
}

/** Guarda de rota do painel: redireciona ao /login em 401; mostra erro se a API estiver fora do ar. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, recheck } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === 'unauthenticated') {
      const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [state.status, pathname, router]);

  if (state.status === 'authenticated') return <>{children}</>;
  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface shadow-card">
          <ErrorState title="Não foi possível conectar à API" error={state.error} onRetry={() => void recheck()} />
          <div className="border-t border-line p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => router.replace('/login')}>
              Ir para o login
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label={state.status === 'loading' ? 'Verificando sessão…' : 'Redirecionando para o login…'} />
    </div>
  );
}
