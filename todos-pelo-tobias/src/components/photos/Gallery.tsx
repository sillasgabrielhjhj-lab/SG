"use client";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/content/photos";
import { cn } from "@/lib/cn";
import { Lightbox } from "./Lightbox";
import { PhotoFrame } from "./PhotoFrame";

const navButton =
  "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-900 shadow-soft backdrop-blur transition hover:scale-105 hover:bg-white sm:size-12";

export function Gallery({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const total = photos.length;
  const current = photos[index];

  // mantém a miniatura ativa centralizada na faixa (sem rolar a página inteira)
  useEffect(() => {
    const el = strip.current;
    const thumb = el?.children[index] as HTMLElement | undefined;
    if (el && thumb) {
      el.scrollTo({
        left: thumb.offsetLeft - (el.clientWidth - thumb.clientWidth) / 2,
        behavior: "smooth",
      });
    }
  }, [index]);

  if (!current) return null;
  const go = (next: number) => setIndex((next + total) % total);

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={`Ampliar foto ${index + 1} de ${total}${current.src ? `: ${current.alt}` : ""}`}
          className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[1.75rem] bg-brand-50 shadow-lift ring-1 ring-brand-100 sm:aspect-[16/10]"
        >
          <PhotoFrame
            key={index}
            photo={current}
            index={index}
            decorative
            hideLabel
            sizes="(min-width: 1152px) 1100px, 100vw"
            className="animate-pop transition duration-700 group-hover:scale-[1.03]"
          />
          <span
            aria-hidden
            className="absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-xs font-bold text-brand-900 shadow-soft backdrop-blur transition group-hover:bg-white sm:text-sm"
          >
            <Expand className="size-4" />
            Ampliar
          </span>
        </button>
        <p className="pointer-events-none absolute top-4 left-4 rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-white backdrop-blur">
          {index + 1} / {total}
        </p>
        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Foto anterior"
              className={cn(navButton, "left-3")}
            >
              <ChevronLeft aria-hidden className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Próxima foto"
              className={cn(navButton, "right-3")}
            >
              <ChevronRight aria-hidden className="size-6" />
            </button>
          </>
        ) : null}
      </div>

      {current.src ? null : (
        <p className="mt-4 text-center text-sm font-medium text-muted">
          As fotos do Tobias aparecerão aqui em breve.
        </p>
      )}

      {total > 1 ? (
        <div
          ref={strip}
          aria-label="Miniaturas das fotos"
          className="mt-4 flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto px-1 py-2 [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <button
              key={`${photo.src ?? "reservado"}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver foto ${i + 1}${photo.src ? `: ${photo.alt}` : ""}`}
              aria-current={i === index}
              className={cn(
                "relative h-16 w-[5.5rem] shrink-0 snap-center overflow-hidden rounded-xl transition duration-300 sm:h-20 sm:w-28",
                i === index
                  ? "scale-100 ring-[3px] ring-brand-600 ring-offset-2"
                  : "scale-95 opacity-70 hover:scale-100 hover:opacity-100",
              )}
            >
              <PhotoFrame photo={photo} index={i} sizes="112px" compact decorative />
            </button>
          ))}
        </div>
      ) : null}

      {zoomed ? (
        <Lightbox
          photos={photos}
          index={index}
          onIndex={setIndex}
          onClose={() => setZoomed(false)}
        />
      ) : null}
    </div>
  );
}
