'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

export interface FetchState<T> {
  data: T | undefined;
  error: ApiError | Error | null;
  /** Primeira carga (sem dados ainda). */
  loading: boolean;
  /** Requisição em andamento (inclusive revalidações). */
  fetching: boolean;
  updatedAt: Date | null;
  reload: () => Promise<void>;
  mutate: (updater: T | ((prev: T | undefined) => T | undefined)) => void;
}

interface Options {
  /** Revalidação periódica (ms). Pausa com a aba oculta. */
  intervalMs?: number;
  enabled?: boolean;
}

/**
 * Busca com revalidação. `key` identifica a requisição (mudou ⇒ rebusca, mantendo os dados antigos na tela
 * até chegarem os novos). Erros em revalidações silenciosas não apagam os dados já exibidos.
 */
export function useFetch<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>, opts: Options = {}): FetchState<T> {
  const { intervalMs, enabled = true } = opts;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [fetching, setFetching] = useState(enabled);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const id = ++seq.current;
    setFetching(true);
    try {
      const result = await fetcherRef.current(ctrl.signal);
      if (id !== seq.current) return;
      setData(result);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      if (id !== seq.current || (e instanceof DOMException && e.name === 'AbortError')) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (id === seq.current) setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run();
    return () => {
      seq.current++;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || !intervalMs) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const t = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, intervalMs, run]);

  const mutate = useCallback((u: T | ((prev: T | undefined) => T | undefined)) => {
    setData((prev) => (typeof u === 'function' ? (u as (p: T | undefined) => T | undefined)(prev) : u));
  }, []);

  return { data, error, loading: data === undefined && !error && fetching, fetching, updatedAt, reload: run, mutate };
}
