"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

/** Evento disparado após gravações feitas por esta aplicação (a aba atual não recebe "storage"). */
const LOCAL_EVENT = "mrc:storage";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_EVENT, callback);
  // Compatibilidade: o seletor de CEP anuncia mudanças com "mrc:cep".
  window.addEventListener("mrc:cep", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_EVENT, callback);
    window.removeEventListener("mrc:cep", callback);
  };
}

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // modo privado / armazenamento bloqueado
  }
}

export function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* armazenamento indisponível */
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

/** Valor bruto de uma chave do localStorage (null no servidor e na hidratação). */
export function useStorageValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readStorage(key),
    () => null,
  );
}

/** Estado persistido em localStorage, sincronizado entre componentes e abas. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [initialValue] = useState(initial); // estável entre renderizações
  const raw = useStorageValue(key);
  const value = useMemo<T>(() => {
    if (raw === null) return initialValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  }, [raw, initialValue]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const currentRaw = readStorage(key);
      let prev = initialValue;
      if (currentRaw !== null) {
        try {
          prev = JSON.parse(currentRaw) as T;
        } catch {
          /* valor corrompido: recomeça do inicial */
        }
      }
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeStorage(key, JSON.stringify(resolved));
    },
    [key, initialValue],
  );
  return [value, update] as const;
}
