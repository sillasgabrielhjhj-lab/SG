import Link from "next/link";
import { Star, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, formatCurrencyBRL, formatInstallments } from "@/lib/utils";
import type { ProductCardData } from "@/lib/data/catalog";

const FREE_SHIPPING_THRESHOLD_CENTS = 9900;

export function ProductCard({
  product,
  className,
}: {
  product: ProductCardData;
  className?: string;
}) {
  const hasDiscount =
    product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents;
  const discountPct = hasDiscount
    ? Math.round((1 - product.priceCents / product.compareAtPriceCents!) * 100)
    : 0;
  const imageUrl = product.images[0]?.url ?? "/placeholders/ph-0.svg";
  const freeShipping = product.priceCents >= FREE_SHIPPING_THRESHOLD_CENTS;

  return (
    <Link
      href={`/produto/${product.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={product.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        {hasDiscount && (
          <Badge variant="accent" className="absolute top-2 left-2">
            -{discountPct}%
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 min-h-10 text-sm text-foreground">
          {product.name}
        </p>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="size-3.5 fill-warning text-warning" />
          <span>{product.ratingAvg.toFixed(1)}</span>
          <span>({product.ratingCount})</span>
        </div>

        <div className="mt-auto flex flex-col">
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrencyBRL(product.compareAtPriceCents!)}
            </span>
          )}
          <span className="font-display text-lg font-bold text-foreground">
            {formatCurrencyBRL(product.priceCents)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatInstallments(product.priceCents)}
          </span>
        </div>

        {freeShipping && (
          <div className="flex items-center gap-1 text-xs font-medium text-success">
            <Truck className="size-3.5" />
            Frete grátis
          </div>
        )}
      </div>
    </Link>
  );
}
