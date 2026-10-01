'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** false no servidor e na hidratação; true depois que o app roda no navegador. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
