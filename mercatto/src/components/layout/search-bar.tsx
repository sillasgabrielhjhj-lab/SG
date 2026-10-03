"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Clock, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readSearchHistory } from "@/components/search/search-history-tracker";

type Suggestion = { id: string; name: string; slug: string };

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      if (!trimmed) {
        setSuggestions([]);
        return;
      }
      fetch(`/api/search/suggestions?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => setSuggestions(data.items ?? []))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function handleFocus() {
    setHistory(readSearchHistory());
    setOpen(true);
  }

  function goToSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    goToSearch(query);
  }

  const showDropdown = open && (suggestions.length > 0 || (!query.trim() && history.length > 0));

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form onSubmit={handleSubmit} role="search" className="flex w-full items-center">
        <div className="relative w-full">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            placeholder="Buscar produtos, marcas e muito mais..."
            aria-label="Buscar produtos"
            autoComplete="off"
            className="h-11 rounded-r-none border-r-0 pr-3"
          />
        </div>
        <Button type="submit" aria-label="Buscar" className="h-11 rounded-l-none px-4">
          <Search className="size-4" />
        </Button>
      </form>

      {showDropdown && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {!query.trim() && history.length > 0 && (
            <div className="border-b border-border p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">Pesquisas recentes</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("mercatto:search-history");
                    setHistory([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Limpar
                </button>
              </div>
              {history.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToSearch(item)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <Clock className="size-3.5 text-muted-foreground" />
                  {item}
                </button>
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="p-2">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/produto/${item.slug}`);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <Search className="size-3.5 text-muted-foreground" />
                  {item.name}
                </button>
              ))}
            </div>
          )}

          {query.trim() && suggestions.length === 0 && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <X className="size-3.5" /> Nenhuma sugestão encontrada
            </div>
          )}
        </div>
      )}
    </div>
  );
}
