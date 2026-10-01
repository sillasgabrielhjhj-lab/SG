"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn("flex w-full items-center", className)}
    >
      <div className="relative w-full">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produtos, marcas e muito mais..."
          aria-label="Buscar produtos"
          className="h-11 rounded-r-none border-r-0 pr-3"
        />
      </div>
      <Button
        type="submit"
        aria-label="Buscar"
        className="h-11 rounded-l-none px-4"
      >
        <Search className="size-4" />
      </Button>
    </form>
  );
}
