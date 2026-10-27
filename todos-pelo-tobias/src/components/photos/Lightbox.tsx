"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Photo } from "@/content/photos";
import { PhotoFrame } from "./PhotoFrame";

interface LightboxProps {
  photos: Photo[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}

const arrow =
  "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 sm:size-12";

/** Ampliação em tela cheia usando <dialog> nativo: foco preso, Esc fecha, fundo inerte. */
export function Lightbox({ photos, index, onIndex, onClose }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const total = photos.length;
  const photo = photos[index];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close(); // devolve o foco ao botão que abriu a ampliação
    };
  }, []);

  if (!photo) return null;
  const go = (next: number) => onIndex((next + total) % total);
  const closeOnBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Fotos do Tobias"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-white backdrop:bg-brand-950/90 backdrop:backdrop-blur-sm open:animate-pop"
    >
      <div
        className="flex h-full flex-col"
        onClick={closeOnBackdrop}
        onTouchStart={(e) => {
          touchStart.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          const end = e.changedTouches[0]?.clientX;
          touchStart.current = null;
          if (start === null || end === undefined || total < 2) return;
          if (Math.abs(end - start) > 48) go(index + (end < start ? 1 : -1));
        }}
      >
        <div className="flex items-center justify-between p-4" onClick={closeOnBackdrop}>
          <p className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold backdrop-blur">
            {index + 1} / {total}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ampliação"
            className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/30"
          >
            <X aria-hidden className="size-6" />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-20"
          onClick={closeOnBackdrop}
        >
          <div className="relative h-full max-h-[74dvh] w-full max-w-5xl overflow-hidden rounded-2xl">
            <PhotoFrame
              key={index}
              photo={photo}
              index={index}
              fit="contain"
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="animate-pop"
            />
          </div>
          {total > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Foto anterior"
                className={`${arrow} left-2 sm:left-5`}
              >
                <ChevronLeft aria-hidden className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Próxima foto"
                className={`${arrow} right-2 sm:right-5`}
              >
                <ChevronRight aria-hidden className="size-6" />
              </button>
            </>
          ) : null}
        </div>

        <p className="min-h-16 p-4 text-center text-sm text-white/90" onClick={closeOnBackdrop}>
          {photo.caption ?? ""}
        </p>
      </div>
    </dialog>
  );
}
