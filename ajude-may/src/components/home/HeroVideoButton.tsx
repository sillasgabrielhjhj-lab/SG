"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { Lightbox } from "@/components/photos/Lightbox";
import type { Photo } from "@/content/photos";

/** Botão "Assista ao vídeo" sobre a foto da capa: abre o vídeo na mesma ampliação da galeria. */
export function HeroVideoButton({ video }: { video: Photo }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-20 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-white/95 py-2 pr-5 pl-2 text-sm font-extrabold whitespace-nowrap text-ink shadow-lift ring-1 ring-petal-100 backdrop-blur transition hover:bg-white active:scale-[0.98]"
      >
        <span className="relative grid size-9 place-items-center rounded-full bg-petal-600 text-white">
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-petal-400/60 [animation-duration:2.4s]"
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
