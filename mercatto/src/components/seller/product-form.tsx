"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";

import type { ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/auth/field-error";
import { ImageUploader, type ProductImage } from "@/components/seller/image-uploader";
import { AttributesEditor, type Attribute } from "@/components/seller/attributes-editor";
import { VariantsEditor, type VariantRow } from "@/components/seller/variants-editor";

const initialState: ActionState = { status: "idle" };

export type ProductFormDefaults = {
  productId?: string;
  name: string;
  description: string;
  categoryId: string;
  brandId: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  promotionStartsAt: string;
  promotionEndsAt: string;
  stock: string;
  weightGrams: string;
  heightCm: string;
  widthCm: string;
  lengthCm: string;
  images: ProductImage[];
  attributes: Attribute[];
  variants: VariantRow[];
};

export function ProductForm({
  categories,
  brands,
  defaults,
  action,
  submitLabel,
}: {
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  defaults: ProductFormDefaults;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [images, setImages] = useState<ProductImage[]>(defaults.images);
  const [attributes, setAttributes] = useState<Attribute[]>(defaults.attributes);
  const [variants, setVariants] = useState<VariantRow[]>(defaults.variants);
  const [sku, setSku] = useState(defaults.sku);
  const [price, setPrice] = useState(defaults.price);
  const [costPrice, setCostPrice] = useState(defaults.costPrice);
  const [hasPromotionWindow, setHasPromotionWindow] = useState(
    Boolean(defaults.promotionStartsAt || defaults.promotionEndsAt),
  );

  const priceNum = Number(price);
  const costNum = Number(costPrice);
  const margin =
    costPrice && priceNum > 0 && costNum >= 0 ? ((priceNum - costNum) / priceNum) * 100 : null;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {defaults.productId && <input type="hidden" name="productId" value={defaults.productId} />}
      <input type="hidden" name="imagesJson" value={JSON.stringify(images)} />
      <input type="hidden" name="attributesJson" value={JSON.stringify(attributes.filter((a) => a.name && a.value))} />
      <input
        type="hidden"
        name="variantsJson"
        value={JSON.stringify(variants.filter((v) => v.name && v.sku))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Informações básicas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-5">
          <div>
            <Label htmlFor="name">Nome do produto</Label>
            <Input id="name" name="name" defaultValue={defaults.name} required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={defaults.description}
              required
              minLength={10}
              className="mt-1.5 min-h-32"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="categoryId">Categoria</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={defaults.categoryId}
                required
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Selecione...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="brandId">Marca (opcional)</Label>
              <select
                id="brandId"
                name="brandId"
                defaultValue={defaults.brandId}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Sem marca</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              name="sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="mt-1.5"
            />
            <FieldError errors={state.fieldErrors?.sku} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imagens</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <ImageUploader images={images} onChange={setImages} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preço e estoque</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="price">Preço de venda (R$)</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="compareAtPrice">Preço riscado (R$, opcional)</Label>
              <Input
                id="compareAtPrice"
                name="compareAtPrice"
                type="number"
                step="0.01"
                defaultValue={defaults.compareAtPrice}
                className="mt-1.5"
              />
              <FieldError errors={state.fieldErrors?.compareAtPriceCents} />
            </div>
            <div>
              <Label htmlFor="stock">Estoque</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min="0"
                defaultValue={defaults.stock}
                disabled={variants.length > 0}
                required={variants.length === 0}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="costPrice">Preço de custo (R$, opcional — só você vê)</Label>
              <Input
                id="costPrice"
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="mt-1.5"
              />
              {margin !== null && (
                <p className={`mt-1.5 text-xs ${margin < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {margin < 0
                    ? `Atenção: vendendo abaixo do custo (margem ${margin.toFixed(0)}%)`
                    : `Margem: ${margin.toFixed(0)}%`}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="mb-0">Período da promoção (opcional)</Label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={hasPromotionWindow}
                  onChange={(e) => setHasPromotionWindow(e.target.checked)}
                />
                Definir prazo
              </label>
            </div>
            {hasPromotionWindow ? (
              <div className="mt-1.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="promotionStartsAt" className="text-xs text-muted-foreground">
                    Início
                  </Label>
                  <Input
                    id="promotionStartsAt"
                    name="promotionStartsAt"
                    type="datetime-local"
                    defaultValue={defaults.promotionStartsAt}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="promotionEndsAt" className="text-xs text-muted-foreground">
                    Fim
                  </Label>
                  <Input
                    id="promotionEndsAt"
                    name="promotionEndsAt"
                    type="datetime-local"
                    defaultValue={defaults.promotionEndsAt}
                    className="mt-1"
                  />
                  <FieldError errors={state.fieldErrors?.promotionEndsAt} />
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Sem prazo definido, o preço riscado vale por tempo indeterminado.
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Variações (opcional)</Label>
            <VariantsEditor variants={variants} onChange={setVariants} baseSkuHint={sku} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dimensões e peso (opcional)</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <Label htmlFor="weightGrams">Peso (g)</Label>
              <Input id="weightGrams" name="weightGrams" type="number" defaultValue={defaults.weightGrams} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="heightCm">Altura (cm)</Label>
              <Input id="heightCm" name="heightCm" type="number" step="0.1" defaultValue={defaults.heightCm} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="widthCm">Largura (cm)</Label>
              <Input id="widthCm" name="widthCm" type="number" step="0.1" defaultValue={defaults.widthCm} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="lengthCm">Comprimento (cm)</Label>
              <Input id="lengthCm" name="lengthCm" type="number" step="0.1" defaultValue={defaults.lengthCm} className="mt-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Características</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <AttributesEditor attributes={attributes} onChange={setAttributes} />
        </CardContent>
      </Card>

      {state.status === "error" && state.message && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}
      {state.status === "success" && state.message && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{state.message}</p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
