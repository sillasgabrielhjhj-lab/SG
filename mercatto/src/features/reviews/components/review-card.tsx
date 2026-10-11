import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { RatingStars } from "@/components/commerce/rating";
import { DemoBadge } from "@/components/commerce/badges";
import { ReviewVideos } from "@/features/reviews/components/review-videos";
import { formatDate } from "@/lib/format";

/**
 * Avaliação de um comprador. Na vitrine pública a data não aparece (fica no
 * banco e nos painéis) — mostra quem avaliou, a nota, o texto e as mídias,
 * como nos grandes marketplaces. `date` só é passado pelos painéis.
 */
export function ReviewCard({
  author,
  rating,
  title,
  comment,
  photos,
  videos,
  isVerifiedPurchase,
  isDemo,
  variantName,
  product,
  date,
}: {
  author: string;
  rating: number;
  title: string | null;
  comment: string | null;
  photos: string[];
  videos: string[];
  isVerifiedPurchase: boolean;
  isDemo?: boolean;
  variantName?: string | null;
  /** Produto avaliado (lista de avaliações da loja). */
  product?: { name: string; slug: string };
  /** Data da avaliação — somente em painéis internos, nunca na vitrine. */
  date?: Date;
}) {
  const initial = author.trim().charAt(0).toUpperCase() || "C";
  return (
    <article className="flex flex-col gap-2.5">
      <header className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700" aria-hidden>
          {initial}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-fg">{author}</span>
          {isVerifiedPurchase ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-700">
              <BadgeCheck className="size-3.5" aria-hidden /> Compra verificada
            </span>
          ) : null}
        </div>
        {isDemo ? <DemoBadge className="ml-auto" /> : null}
      </header>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <RatingStars value={rating} size="md" />
        {title ? <h3 className="min-w-0 text-sm font-semibold break-words text-fg">{title}</h3> : null}
      </div>
      {product || date || (variantName && variantName !== "Padrão") ? (
        <p className="flex flex-wrap gap-x-2 text-xs text-fg-muted">
          {product ? (
            <Link href={`/produto/${product.slug}#avaliacoes`} className="line-clamp-1 font-semibold hover:text-brand-700 hover:underline focus-ring">
              {product.name}
            </Link>
          ) : null}
          {variantName && variantName !== "Padrão" ? <span>{variantName}</span> : null}
          {date ? <time dateTime={date.toISOString()}>{formatDate(date)}</time> : null}
        </p>
      ) : null}
      {comment ? <p className="text-sm leading-relaxed break-words whitespace-pre-line text-fg">{comment}</p> : null}
      <ReviewVideos urls={videos} />
      {photos.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Fotos enviadas pelo comprador">
          {photos.map((src, i) => (
            <li key={src}>
              <a href={src} target="_blank" rel="noopener noreferrer" className="relative block size-16 overflow-hidden rounded-lg border border-line bg-white focus-ring sm:size-20" aria-label={`Abrir foto ${i + 1} em tamanho real`}>
                <Image src={src} alt={`Foto ${i + 1} enviada pelo comprador`} fill sizes="80px" unoptimized={src.endsWith(".svg")} className="object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
