"use client";

import { Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type VariantRow = { name: string; sku: string; priceCents: number | null; stock: number };

export function VariantsEditor({
  variants,
  onChange,
  baseSkuHint,
}: {
  variants: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
  baseSkuHint: string;
}) {
  function update(index: number, patch: Partial<VariantRow>) {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function remove(index: number) {
    onChange(variants.filter((_, i) => i !== index));
  }

  function add() {
    onChange([
      ...variants,
      { name: "", sku: `${baseSkuHint || "SKU"}-${variants.length + 1}`, priceCents: null, stock: 0 },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      {variants.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Sem variações, o produto usa um único estoque (campo &quot;Estoque&quot; acima). Adicione
          variações para tamanhos, cores etc, cada uma com seu próprio estoque.
        </p>
      )}

      {variants.map((variant, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_120px_100px_auto] items-end gap-2 rounded-md border border-border p-3">
          <div>
            <Label className="text-xs">Nome da variação</Label>
            <Input
              placeholder="Cor: Azul"
              value={variant.name}
              onChange={(e) => update(index, { name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">SKU</Label>
            <Input
              value={variant.sku}
              onChange={(e) => update(index, { sku: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Preço (R$, opcional)</Label>
            <Input
              type="number"
              step="0.01"
              value={variant.priceCents !== null ? variant.priceCents / 100 : ""}
              onChange={(e) =>
                update(index, {
                  priceCents: e.target.value ? Math.round(Number(e.target.value) * 100) : null,
                })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Estoque</Label>
            <Input
              type="number"
              min={0}
              value={variant.stock}
              onChange={(e) => update(index, { stock: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remover variação">
            <X className="size-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-fit">
        <Plus className="size-3.5" /> Adicionar variação
      </Button>
    </div>
  );
}
