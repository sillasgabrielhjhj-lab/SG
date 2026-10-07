"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { skipImageOptimization } from "@/lib/images";

export type GalleryImage = { id: string; url: string; alt: string };


/** Galeria com miniaturas, zoom por ponteiro (desktop), swipe (mobile) e tela cheia acessível. */
export function ProductGallery({ images, activeImageId, name }: { images: GalleryImage[]; activeImageId?: string | null; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const touch = useRef<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const count = images.length;

  const [prevActiveImageId, setPrevActiveImageId] = useState(activeImageId);
  if (prevActiveImageId !== activeImageId) {
    setPrevActiveImageId(activeImageId);
    const i = activeImageId ? images.findIndex((img) => img.id === activeImageId) : -1;
    if (i >= 0) setIndex(i);
  }

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (fullscreen && !d.open) d.showModal();
    if (!fullscreen && d.open) d.close();
  }, [fullscreen]);

  const go = (i: number) => setIndex((i + count) % count);
  const current = images[index];
  if (!current) {
    return <div className="grid aspect-square place-items-center rounded-card border border-line bg-surface text-sm text-fg-muted">Sem imagens</div>;
  }

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      {count > 1 ? (
        <ul className="flex gap-2 overflow-x-auto scrollbar-none md:max-h-[520px] md:flex-col md:overflow-y-auto" aria-label="Miniaturas">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} onMouseEnter={() => setIndex(i)} aria-label={`Ver imagem ${i + 1} de ${count}`} aria-current={i === index} className={cn("relative block size-16 overflow-hidden rounded-md border-2 bg-white transition-colors focus-ring", i === index ? "border-brand-600" : "border-line hover:border-line-strong")}>
                <Image src={img.url} alt="" fill sizes="64px" unoptimized={skipImageOptimization(img.url)} className="object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative min-w-0 flex-1">
        <div
          data-product-main-image=""
          className="relative aspect-square cursor-zoom-in overflow-hidden rounded-card border border-line bg-white"
          onMouseMove={(e) => {
            if (window.matchMedia("(hover: none)").matches) return;
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          onClick={() => setFullscreen(true)}
          onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const start = touch.current;
            const end = e.changedTouches[0]?.clientX;
            if (start !== null && end !== undefined && Math.abs(end - start) > 40) go(index + (end < start ? 1 : -1));
          }}
        >
          <Image
            key={current.id}
            src={current.url}
            alt={current.alt || name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 560px"
            unoptimized={skipImageOptimization(current.url)}
            className="animate-fade-in object-contain p-4 transition-transform duration-150 ease-out"
            style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
          <button type="button" onClick={(e) => (e.stopPropagation(), setFullscreen(true))} className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-surface/90 text-fg shadow-sm ring-1 ring-line hover:text-brand-700 focus-ring" aria-label="Ampliar imagem em tela cheia">
            <Maximize2 className="size-4" />
          </button>
          {count > 1 ? (
            <span className="absolute bottom-3 left-3 rounded-full bg-fg/70 px-2 py-0.5 text-xs font-semibold text-white md:hidden">
              {index + 1}/{count}
            </span>
          ) : null}
        </div>
      </div>

      <dialog ref={dialog} onClose={() => setFullscreen(false)} onCancel={() => setFullscreen(false)} aria-label={`Imagens de ${name}`} className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 backdrop:bg-black/80">
        {fullscreen ? (
          <div className="relative flex h-full flex-col" onKeyDown={(e) => (e.key === "ArrowRight" ? go(index + 1) : e.key === "ArrowLeft" ? go(index - 1) : undefined)}>
            <div className="flex items-center justify-between p-3">
              <span className="text-sm font-semibold text-fg-muted">
                {index + 1} de {count}
              </span>
              <button type="button" autoFocus onClick={() => setFullscreen(false)} className="grid size-11 place-items-center rounded-full hover:bg-surface-muted focus-ring" aria-label="Fechar">
                <X className="size-6" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <Image src={current.url} alt={current.alt || name} fill sizes="100vw" unoptimized={skipImageOptimization(current.url)} className="object-contain p-4" />
              {count > 1 ? (
                <>
                  <button type="button" onClick={() => go(index - 1)} className="absolute top-1/2 left-3 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-surface shadow-raised ring-1 ring-line focus-ring" aria-label="Imagem anterior">
                    <ChevronLeft className="size-6" />
                  </button>
                  <button type="button" onClick={() => go(index + 1)} className="absolute top-1/2 right-3 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-surface shadow-raised ring-1 ring-line focus-ring" aria-label="Próxima imagem">
                    <ChevronRight className="size-6" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
