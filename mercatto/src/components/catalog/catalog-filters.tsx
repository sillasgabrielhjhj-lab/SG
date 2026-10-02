"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Brand = { id: string; name: string; slug: string };

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "best_selling", label: "Mais vendidos" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "rating", label: "Melhor avaliados" },
  { value: "newest", label: "Lançamentos" },
];

const RATING_OPTIONS = [4, 3, 2, 1];

function useCatalogFilterState(basePath: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    startTransition(() => router.push(`${basePath}?${params.toString()}`));
  }

  return {
    searchParams,
    isPending,
    pushParams,
    sort: searchParams.get("sort") ?? "relevance",
    minPrice: searchParams.get("min") ?? "",
    maxPrice: searchParams.get("max") ?? "",
    selectedBrands: searchParams.getAll("marca"),
    selectedRating: searchParams.get("avaliacao") ?? "",
  };
}

function FilterFields({
  basePath,
  brands,
  radioGroupName,
}: {
  basePath: string;
  brands: Brand[];
  radioGroupName: string;
}) {
  const { pushParams, minPrice, maxPrice, selectedBrands, selectedRating } =
    useCatalogFilterState(basePath);

  function handlePriceSubmit(formData: FormData) {
    pushParams((params) => {
      const min = formData.get("min")?.toString().trim();
      const max = formData.get("max")?.toString().trim();
      if (min) params.set("min", min);
      else params.delete("min");
      if (max) params.set("max", max);
      else params.delete("max");
    });
  }

  function toggleBrand(slug: string) {
    pushParams((params) => {
      const current = params.getAll("marca");
      params.delete("marca");
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      next.forEach((s) => params.append("marca", s));
    });
  }

  function setRating(value: string) {
    pushParams((params) => {
      if (selectedRating === value) params.delete("avaliacao");
      else params.set("avaliacao", value);
    });
  }

  function clearAll() {
    pushParams((params) => {
      const q = params.get("q");
      Array.from(params.keys()).forEach((key) => params.delete(key));
      if (q) params.set("q", q);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Preço</p>
        <form action={handlePriceSubmit} className="flex items-center gap-2">
          <Input name="min" defaultValue={minPrice} placeholder="Mín" inputMode="numeric" className="h-9" />
          <span className="text-muted-foreground">–</span>
          <Input name="max" defaultValue={maxPrice} placeholder="Máx" inputMode="numeric" className="h-9" />
          <Button type="submit" size="sm" variant="outline">
            Ir
          </Button>
        </form>
      </div>

      {brands.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">Marca</p>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {brands.map((brand) => (
              <label key={brand.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand.slug)}
                  onChange={() => toggleBrand(brand.slug)}
                  className="size-4 rounded border-input"
                />
                {brand.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Avaliação</p>
        <div className="flex flex-col gap-1.5">
          {RATING_OPTIONS.map((rating) => (
            <label key={rating} className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="radio"
                name={radioGroupName}
                checked={selectedRating === String(rating)}
                onChange={() => setRating(String(rating))}
                className="size-4"
              />
              {rating}+ estrelas
            </label>
          ))}
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={clearAll} className="w-fit text-muted-foreground">
        Limpar filtros
      </Button>
    </div>
  );
}

function SortSelect({ basePath }: { basePath: string }) {
  const { pushParams, sort, isPending } = useCatalogFilterState(basePath);

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sort" className="hidden text-sm text-muted-foreground sm:inline">
        Ordenar por
      </Label>
      <select
        id="sort"
        value={sort}
        onChange={(e) => pushParams((params) => params.set("sort", e.target.value))}
        disabled={isPending}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Barra superior: botão "Filtros" (abre Sheet no mobile) + ordenação.
 * Usada junto com <CatalogFiltersSidebar> (que só aparece em telas largas). */
export function CatalogToolbar({ basePath, brands }: { basePath: string; brands: Brand[] }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="lg:hidden">
            <SlidersHorizontal className="size-4" /> Filtros
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <FilterFields basePath={basePath} brands={brands} radioGroupName="avaliacao-mobile" />
        </SheetContent>
      </Sheet>

      <div className="ml-auto">
        <SortSelect basePath={basePath} />
      </div>
    </div>
  );
}

export function CatalogFiltersSidebar({ basePath, brands }: { basePath: string; brands: Brand[] }) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <FilterFields basePath={basePath} brands={brands} radioGroupName="avaliacao-desktop" />
    </aside>
  );
}
