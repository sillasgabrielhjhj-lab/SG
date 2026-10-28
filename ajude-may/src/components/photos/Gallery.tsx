"use client";

import { Expand, Images } from "lucide-react";
import { useState } from "react";
import type { Photo } from "@/content/photos";
import { cn } from "@/lib/cn";
import { Lightbox } from "./Lightbox";
import { PhotoFrame } from "./PhotoFrame";

/** Quantas fotos aparecem na grade (as demais ficam na ampliação, com o selo "+N"). */
const VISIBLE = 5;

/**
 * Foto principal em destaque + grade de fotos (com 5 ou mais) ou lado a lado (com poucas); qualquer
 * uma abre a ampliação com navegação. Vídeos aparecem com a capa e o ícone de play.
 */
export function Gallery({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const total = photos.length;
  const visible = photos.slice(0, VISIBLE);
  const hidden = total - visible.length;
  const bento = total >= VISIBLE;

  return (
    <div>
      <ul
        className={cn(
          "grid grid-cols-2 gap-3 sm:gap-4",
          bento ? "md:grid-cols-4 md:grid-rows-2" : "mx-auto max-w-3xl",
        )}
      >
        {visible.map((photo, i) => {
          const featured = bento && i === 0;
          const more = i === visible.length - 1 && hidden > 0;
          return (
            <li
              key={`${photo.src ?? "reservado"}-${i}`}
              className={cn(featured && "col-span-2 md:row-span-2")}
            >
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={
                  photo.video
                    ? `Assistir ao vídeo: ${photo.alt}`
                    : `Ampliar foto ${i + 1} de ${total}${photo.src ? `: ${photo.alt}` : ": Foto da May em breve"}`
                }
                className={cn(
                  "group relative block w-full overflow-hidden bg-petal-50 shadow-soft ring-1 ring-petal-100",
                  featured
                    ? "aspect-[4/3] rounded-[2rem] md:aspect-auto md:h-full md:min-h-[26rem]"
                    : bento
                      ? "aspect-square rounded-3xl"
                      : "aspect-[4/5] rounded-[2rem]",
                )}
              >
                <PhotoFrame
                  photo={photo}
                  index={i}
                  decorative
                  compact={bento && !featured}
                  sizes={
                    featured ? "(min-width: 768px) 560px, 100vw" : "(min-width: 768px) 270px, 50vw"
                  }
                  className="transition duration-700 group-hover:scale-[1.04]"
                />
                {more ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 grid place-items-center bg-lilac-950/55 font-display text-3xl font-semibold text-white backdrop-blur-[2px]"
                  >
                    +{hidden}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-white/90 text-petal-800 opacity-0 shadow-soft transition group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    <Expand className="size-4" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        {photos[0]?.src ? (
          <button
            type="button"
            onClick={() => setOpen(0)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-petal-800 ring-1 ring-petal-200 transition hover:bg-petal-50"
          >
            <Images aria-hidden className="size-4" />
            Ver todas as fotos ({total})
          </button>
        ) : (
          <p className="text-sm font-medium text-muted">
            As fotos da May serão publicadas aqui, com a autorização da família.
          </p>
        )}
      </div>

      {open !== null ? (
        <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}
