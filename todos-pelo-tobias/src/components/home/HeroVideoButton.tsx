"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { Lightbox } from "@/components/photos/Lightbox";
import type { Photo } from "@/content/photos";

/** Botão "Assista ao vídeo" sobre a foto da capa: abre o vídeo na mesma janela de ampliação da galeria. */
export function HeroVideoButton({ video }: { video: Photo }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-12 left-3 z-10 inline-flex items-center gap-2.5 rounded-full bg-white/95 py-2 pr-4 pl-2 text-sm font-extrabold text-brand-950 shadow-lift ring-1 ring-brand-100 backdrop-blur transition hover:scale-[1.03] hover:bg-white active:scale-[0.98] sm:bottom-14 sm:left-4 sm:text-[0.95rem]"
      >
        <span className="relative grid size-10 place-items-center rounded-full bg-brand-600 text-white">
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-brand-500/60 [animation-duration:2.4s]"
          />
          <Play aria-hidden className="relative size-4 translate-x-px fill-current" />
        </span>
        Assista ao vídeo
      </button>
      {open ? (
        <Lightbox photos={[video]} index={0} onIndex={() => {}} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
