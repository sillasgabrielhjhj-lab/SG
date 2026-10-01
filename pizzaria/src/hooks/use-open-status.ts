'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { getOpenStatus, type OpenStatus } from '@/lib/hours';

const MINUTE = 60_000;

function subscribe(callback: () => void) {
  const id = window.setInterval(callback, 30_000);
  return () => window.clearInterval(id);
}

/** Status "Aberto/Fechado" atualizado a cada minuto. null até rodar no navegador (evita divergência de hidratação). */
export function useOpenStatus(): OpenStatus | null {
  const minute = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MINUTE),
    () => null,
  );
  return useMemo(() => (minute === null ? null : getOpenStatus(new Date(minute * MINUTE))), [minute]);
}
