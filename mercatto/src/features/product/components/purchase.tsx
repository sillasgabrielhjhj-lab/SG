"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, RotateCcw, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";
import type { InstallmentConfig } from "@/lib/money";
import { trackEvent } from "@/lib/analytics";
import type { ProductPageData } from "@/features/product/queries";
import { InstallmentsText, PixPrice, Price } from "@/components/commerce/price";
import { RatingStars } from "@/components/commerce/rating";
import { DemoBadge, FlashBadge, FreeShippingBadge, OfficialBadge, StockIndicator } from "@/components/commerce/badges";
import { FavoriteButton } from "@/components/commerce/favorite-button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { ShareButton } from "@/components/ui/share-button";
import { Countdown } from "@/components/ui/countdown";
import { AddToCartButtons } from "@/features/cart/components/add-to-cart";
import { ShippingSimulator } from "@/features/product/components/shipping-simulator";
import { ProductGallery } from "@/features/product/components/gallery";
import { swatchFor } from "@/lib/swatches";
import "@/lib/swatches-apple";

const CONDITION = { NEW: "Novo", USED: "Usado", REFURBISHED: "Recondicionado" } as const;

/**
 * Bloco principal do produto (galeria + compra). A seleção de variação atualiza
 * preço, estoque, SKU e imagem. Combinações sem estoque ficam indicadas.
 */
export function ProductPurchase({ product, favorited, installmentConfig, pixDiscountPercent }: { product: ProductPageData; favorited: boolean; installmentConfig: InstallmentConfig; pixDiscountPercent: number }) {
  const initial = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [selection, setSelection] = useState<Record<string, string>>(initial?.optionValues ?? {});
  const [requestedQuantity, setQuantity] = useState(1);

  const variant = useMemo(() => {
    if (!product.options.length) return product.variants[0] ?? null;
    return product.variants.find((v) => product.options.every((o) => v.optionValues[o.name] === selection[o.name])) ?? null;
  }, [selection, product]);

  useEffect(() => {
    trackEvent("view_item", { item_id: product.id, item_name: product.name, price: (variant?.priceCents ?? 0) / 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por produto
  }, [product.id]);


  /** Valor da opção está disponível dado o restante da seleção? */
  const optionAvailable = (name: string, value: string) =>
    product.variants.some((v) => v.optionValues[name] === value && v.stock > 0 && product.options.every((o) => o.name === name || !selection[o.name] || v.optionValues[o.name] === selection[o.name]));

  const stock = variant?.stock ?? 0;
  // Quantidade efetiva limitada ao estoque da variação escolhida (derivada, sem efeito).
  const quantity = Math.max(1, Math.min(requestedQuantity, stock || 1, 99));
  const purchasable = product.isAvailable && Boolean(variant) && stock > 0 && product.status === "ACTIVE";
  const images = product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <ProductGallery images={images} activeImageId={variant?.imageId} name={product.name} />

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <span>{CONDITION[product.condition]}</span>
            {product.salesCount > 0 ? <span>· +{formatCompact(product.salesCount)} vendidos</span> : null}
            {product.store.isOfficial ? <OfficialBadge compact /> : null}
            {product.isDemo ? <DemoBadge /> : null}
          </div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl leading-snug font-bold text-fg sm:text-2xl">{product.name}</h1>
            <FavoriteButton productId={product.id} productName={product.name} initial={favorited} className="shrink-0" />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {product.ratingCount > 0 ? (
              <a href="#avaliacoes" className="hover:underline">
                <RatingStars value={product.ratingAvg} count={product.ratingCount} showValue />
              </a>
            ) : (
              <span className="text-xs text-fg-subtle">Ainda sem avaliações</span>
            )}
            {product.brand ? (
              <Link href={`/marca/${product.brand.slug}`} className="text-xs font-semibold text-brand-700 hover:underline">
                Marca: {product.brand.name}
              </Link>
            ) : null}
            <span className="text-xs text-fg-subtle">SKU {variant?.sku ?? product.sku}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
          {variant?.promotion?.isFlash ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-sun-100 px-3 py-2">
              <FlashBadge />
              <span className="flex items-center gap-1.5 text-xs font-semibold text-sun-900">
                <Zap className="size-3.5" aria-hidden /> Termina em <Countdown endsAt={variant.promotion.endsAt} variant="inline" className="font-bold" />
              </span>
              {variant.promotion.remaining !== null ? <span className="w-full text-xs text-sun-800">Restam {variant.promotion.remaining} unidades com este preço</span> : null}
            </div>
          ) : null}

          {variant ? (
            <>
              <Price priceCents={variant.priceCents} listPriceCents={variant.listPriceCents} discountPercent={variant.discountPercent} size="xl" />
              <PixPrice priceCents={variant.priceCents} pixDiscountPercent={pixDiscountPercent} />
              <InstallmentsText priceCents={variant.priceCents} config={installmentConfig} className="text-sm" />
              {variant.promotion && !variant.promotion.isFlash ? <p className="text-xs font-semibold text-brand-700">{variant.promotion.name.replace("[DEMO] ", "")}</p> : null}
            </>
          ) : (
            <p className="text-sm font-semibold text-warning-700">Combinação indisponível — escolha outras opções.</p>
          )}

          {product.options.map((option) => {
            const isColor = /^cor(es)?$/i.test(option.name.trim());
            return (
            <fieldset key={option.name} className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm">
                {option.name}: <strong>{selection[option.name] ?? "—"}</strong>
              </legend>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const selected = selection[option.name] === value;
                  const available = optionAvailable(option.name, value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelection((s) => ({ ...s, [option.name]: value }))}
                      className={cn(
                        "relative min-h-10 min-w-12 rounded-field border px-3 text-sm font-medium transition-all focus-ring",
                        selected ? "border-brand-700 bg-brand-50 text-brand-900 shadow-[inset_0_0_0_1px_var(--color-brand-700)]" : "border-line-strong bg-surface hover:border-brand-500",
                        !available && "border-dashed text-fg-subtle",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {isColor && swatchFor(value) ? <span aria-hidden className="size-4 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: swatchFor(value)! }} /> : null}
                        {value}
                      </span>
                      {!available ? <span className="sr-only"> (esgotado)</span> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            );
          })}

          <div className="flex flex-wrap items-center gap-3">
            {variant ? <StockIndicator stock={stock} /> : null}
            {product.freeShipping ? <FreeShippingBadge /> : null}
          </div>

          {purchasable ? (
            <div className="flex items-center gap-3">
              <span className="text-sm">Quantidade:</span>
              <QuantityStepper value={quantity} onChange={setQuantity} max={Math.min(stock, 99)} />
              <span className="text-xs text-fg-subtle">({stock} disponíveis)</span>
            </div>
          ) : null}

          {purchasable ? (
            <AddToCartButtons variantId={variant?.id ?? null} quantity={quantity} productName={product.name} priceCents={variant?.priceCents ?? 0} />
          ) : (
            <div className="rounded-md bg-surface-muted p-3 text-sm text-fg-muted">
              {product.status === "PAUSED" ? "Este anúncio está pausado no momento." : "Produto esgotado. Favorite para acompanhar o retorno do estoque."}
            </div>
          )}

          <ul className="flex flex-col gap-1.5 border-t border-line pt-3 text-xs text-fg-muted">
            <li className="flex items-center gap-2">
              <RotateCcw className="size-4 text-brand-700" aria-hidden /> Devolução grátis em até 7 dias após o recebimento
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand-700" aria-hidden /> Compra garantida: receba o produto ou seu dinheiro de volta
            </li>
            {product.warrantyMonths ? (
              <li className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-brand-700" aria-hidden /> {product.warrantyMonths} meses de garantia
              </li>
            ) : null}
          </ul>
        </div>

        {product.highlights.length ? (
          <section aria-labelledby="destaques-title" className="rounded-card border border-line bg-surface p-4">
            <h2 id="destaques-title" className="mb-2 text-sm font-bold">
              O que você precisa saber sobre este produto
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-fg-muted marker:text-brand-600">
              {product.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <ShippingSimulator variantId={purchasable ? (variant?.id ?? null) : null} quantity={quantity} />
        <div className="flex justify-end">
          <ShareButton title={product.name} />
        </div>
      </div>
    </div>
  );
}
