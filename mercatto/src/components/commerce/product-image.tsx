"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Imagem de produto: quadrada, contida sobre fundo branco; SVG/demo sem otimização; fallback em erro. */
export function ProductImage({ src, alt, sizes = "(max-width: 640px) 50vw, 240px", priority, className, imgClassName }: { src: string | null; alt: string; sizes?: string; priority?: boolean; className?: string; imgClassName?: string }) {
  const [failed, setFailed] = useState(false);
  const unoptimized = Boolean(src && (src.endsWith(".svg") || src.startsWith("/demo-assets/")));
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-white", className)}>
      {src && !failed ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={unoptimized} onError={() => setFailed(true)} className={cn("object-contain", imgClassName)} />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-surface-muted text-fg-subtle">
          <ImageOff className="size-8" aria-hidden />
          <span className="sr-only">{alt}</span>
        </div>
      )}
    </div>
  );
}
