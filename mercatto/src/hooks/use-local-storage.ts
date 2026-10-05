"use client";

import { useCallback, useEffect, useState } from "react";

/** Estado persistido em localStorage (seguro: falha silenciosa em modo privado/SSR). */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* armazenamento indisponível */
    }
  }, [key]);
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* ignora */
        }
        return resolved;
      });
    },
    [key],
  );
  return [value, update] as const;
}
