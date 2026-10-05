"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

const KEY = "mrc_recent";
const MAX = 20;

/** Produtos vistos recentemente (somente neste navegador). */
export function useRecentlyViewed() {
  const [ids, setIds] = useLocalStorage<string[]>(KEY, []);
  const add = useCallback((id: string) => setIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, MAX)), [setIds]);
  const clear = useCallback(() => setIds([]), [setIds]);
  return { ids, add, clear };
}
