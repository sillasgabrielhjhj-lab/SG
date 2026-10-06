import Link from "next/link";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/features/catalog/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductImage } from "@/components/commerce/product-image";
import { Price } from "@/components/commerce/price";
import { formatBRL } from "@/lib/money";
import { RatingStars } from "@/components/commerce/rating";
import { DemoBadge, DiscountBadge, FlashBadge, FreeShippingBadge, OfficialBadge, StockIndicator } from "@/components/commerce/badges";
import { FavoriteButton } from "@/components/commerce/favorite-button";

/**
 * Card de produto. Link "esticado" cobre o card inteiro (um único alvo de
 * navegação acessível); o botão de favorito fica acima da camada do link.
 */
export function ProductCard({ product, variant = "grid", favorited, priority, className }: { product: ProductCardData; variant?: "grid" | "compact" | "horizontal"; favorited?: boolean; priority?: boolean; className?: string }) {
  const href = `/produto/${product.slug}`;
  const unavailable = product.totalStock <= 0;
  const horizontal = variant === "horizontal";
  return (
    <article
      className={cn(
        "group relative flex overflow-hidden rounded-card border border-line bg-surface transition-[box-shadow,border-color,transform] duration-200 hover:border-line-strong hover:shadow-raised motion-safe:hover:-translate-y-0.5",
        horizontal ? "flex-row" : "flex-col",
        className,
      )}
    >
      <div className={cn("relative shrink-0", horizontal ? "w-32 sm:w-40" : "w-full")}>
        <ProductImage
          src={product.imageUrl}
          alt={product.imageAlt}
          priority={priority}
          sizes={horizontal ? "160px" : variant === "compact" ? "180px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"}
          imgClassName={cn("p-3 transition-transform duration-300 motion-safe:group-hover:scale-[1.04]", unavailable && "opacity-50 grayscale")}
        />
        <div className="absolute top-2 left-2 z-[2] flex flex-col items-start gap-1">
          {product.promotion?.isFlash ? <FlashBadge label="Relâmpago" /> : null}
          {product.discountPercent >= 5 ? <DiscountBadge percent={product.discountPercent} /> : null}
        </div>
        <FavoriteButton productId={product.id} initial={favorited} size="sm" className="absolute top-2 right-2 z-[3]" />
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5", horizontal ? "p-3" : "border-t border-line/60 p-3")}>
        <div className="flex min-h-4 flex-wrap items-center gap-1">
          {product.isOfficial ? <OfficialBadge compact /> : null}
          {product.isDemo ? <DemoBadge /> : null}
        </div>
        <h3 className={cn("line-clamp-2 text-sm leading-snug text-fg", variant === "compact" && "text-[13px]")}>
          <Link href={href} className="after:absolute after:inset-0 after:z-[1] focus-ring after:rounded-card">
            {product.name}
          </Link>
        </h3>
        {unavailable ? (
          <p className="text-sm font-semibold text-fg-muted">Indisponível</p>
        ) : (
          <>
            {product.fromPrice ? <span className="-mb-1 text-xs text-fg-muted">a partir de</span> : null}
            <Price priceCents={product.priceCents} listPriceCents={product.listPriceCents} discountPercent={product.discountPercent} size={variant === "compact" ? "sm" : "md"} showDiscount={product.discountPercent < 5} />
            {product.installment && product.installment.count > 1 ? (
              <p className="text-xs text-fg-muted">
                em até{" "}
                <span className="font-semibold text-brand-700">
                  {product.installment.count}x de {formatBRL(product.installment.installmentCents)} sem juros
                </span>
              </p>
            ) : null}
          </>
        )}
        <div className="mt-auto flex flex-col gap-1 pt-1">
          {product.freeShipping && !unavailable ? <FreeShippingBadge /> : null}
          {!unavailable && product.totalStock <= 5 ? <StockIndicator stock={product.totalStock} /> : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-subtle">
            {product.ratingCount > 0 ? <RatingStars value={product.ratingAvg} count={product.ratingCount} size="xs" /> : null}
            {product.salesCount > 0 ? <span>+{formatCompact(product.salesCount)} vendidos</span> : null}
          </div>
          {!product.isOfficial && variant !== "compact" ? <p className="truncate text-xs text-fg-subtle">por {product.storeName}</p> : null}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton({ variant = "grid" }: { variant?: "grid" | "compact" | "horizontal" }) {
  return (
    <div className={cn("overflow-hidden rounded-card border border-line bg-surface", variant === "horizontal" && "flex")}>
      <div className={cn("skeleton rounded-none", variant === "horizontal" ? "size-32 shrink-0" : "aspect-square w-full")} />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-1 h-6 w-28" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
