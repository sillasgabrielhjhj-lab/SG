"use client";

import { useEffect } from "react";

const STORAGE_KEY = "mercatto:search-history";
const MAX_ITEMS = 8;

export function readSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeSearchHistory(items: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage indisponível (modo privado etc.) — falha silenciosa,
    // histórico de busca é um extra, não algo crítico.
  }
}

/** Componente "invisível" que só registra a busca atual no histórico
 * local do navegador, assim que a página de resultados monta. */
export function SearchHistoryTracker({ query }: { query: string }) {
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const current = readSearchHistory().filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase(),
    );
    writeSearchHistory([trimmed, ...current].slice(0, MAX_ITEMS));
  }, [query]);

  return null;
}
