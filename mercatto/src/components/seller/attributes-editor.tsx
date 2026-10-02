"use client";

import { Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type Attribute = { name: string; value: string };

export function AttributesEditor({
  attributes,
  onChange,
}: {
  attributes: Attribute[];
  onChange: (attributes: Attribute[]) => void;
}) {
  function update(index: number, field: keyof Attribute, value: string) {
    onChange(attributes.map((attr, i) => (i === index ? { ...attr, [field]: value } : attr)));
  }

  function remove(index: number) {
    onChange(attributes.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {attributes.map((attr, index) => (
        <div key={index} className="flex gap-2">
          <Input
            placeholder="Característica (ex: Cor)"
            value={attr.name}
            onChange={(e) => update(index, "name", e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Valor (ex: Azul)"
            value={attr.value}
            onChange={(e) => update(index, "value", e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remover">
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...attributes, { name: "", value: "" }])}
        className="w-fit"
      >
        <Plus className="size-3.5" /> Adicionar característica
      </Button>
    </div>
  );
}
