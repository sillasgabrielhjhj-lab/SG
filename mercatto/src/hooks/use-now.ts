"use client";

import { useSyncExternalStore } from "react";

// Relógio compartilhado: um único timer alinhado ao segundo para todos os contadores.
const listeners = new Set<() => void>();
let timer: number | undefined;

function schedule() {
  timer = window.setTimeout(() => {
    listeners.forEach((l) => l());
    schedule();
  }, 1000 - (Date.now() % 1000));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };
}

/** Segundo atual (epoch, em ms arredondados ao segundo); null no servidor/hidratação. */
export function useNowSecond(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => null,
  );
}
