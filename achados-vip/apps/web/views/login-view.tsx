'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Notice, Spinner } from '@/components/ui/states';
import { ApiError } from '@/lib/api';
import { safeNext, useAuth } from '@/lib/auth';

export function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { state, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Já autenticado: vai direto ao painel.
  useEffect(() => {
    if (state.status === 'authenticated') router.replace(next);
  }, [state.status, next, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError(err.message || 'E-mail ou senha incorretos.');
        else if (err.status === 429 || err.status === 423) setError(err.message || 'Muitas tentativas. Aguarde alguns instantes e tente novamente.');
        else setError(err.message);
      } else {
        setError('Não foi possível entrar. Tente novamente.');
      }
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  if (state.status === 'authenticated') {
    return (
      <main id="conteudo" className="flex min-h-screen items-center justify-center">
        <Spinner label="Entrando…" />
      </main>
    );
  }

  return (
    <main id="conteudo" className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-fg shadow-card" aria-hidden="true">
            <Icon name="tag" size={22} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Achados VIP</h1>
          <p className="mt-1 text-sm text-muted">Entre para acessar o painel administrativo.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-card" noValidate>
          {state.status === 'error' ? (
            <Notice tone="warning" title="API indisponível">
              Não foi possível verificar a sessão agora. Você ainda pode tentar entrar.
            </Notice>
          ) : null}
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Field label="E-mail" required>
            <input className="input" type="email" name="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Field label="Senha" required>
            <input className="input" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!email.trim() || !password}>
            Entrar
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">O acesso é restrito. Tentativas repetidas com senha incorreta bloqueiam a conta temporariamente.</p>
      </div>
    </main>
  );
}
