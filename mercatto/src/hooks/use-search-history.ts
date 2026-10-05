"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

export function useSearchHistory() {
  const [history, setHistory] = useLocalStorage<string[]>("mrc_search_history", []);
  const add = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setHistory((prev) => [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8));
  }, [setHistory]);
  const remove = useCallback((term: string) => setHistory((prev) => prev.filter((x) => x !== term)), [setHistory]);
  const clear = useCallback(() => setHistory([]), [setHistory]);
  return { history, add, remove, clear };
}
