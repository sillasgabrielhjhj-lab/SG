"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Image = { id: string; url: string; altText: string | null };

export function ProductGallery({ images, productName }: { images: Image[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomStyle, setZoomStyle] = useState<{ backgroundPosition: string } | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const active = images[activeIndex] ?? images[0];

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoomStyle({ backgroundPosition: `${x}% ${y}%` });
  }

  if (!active) {
    return <div className="aspect-square rounded-xl bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse">
      <div
        ref={imageRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setZoomStyle(null)}
        className="group relative flex-1 overflow-hidden rounded-xl border border-border bg-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.url}
          alt={active.altText ?? productName}
          className="aspect-square w-full object-cover"
        />
        {/* Camada de zoom: aparece no hover (desktop), usando a mesma
            imagem ampliada e posicionada pelo cursor. */}
        <div
          aria-hidden
          style={{
            backgroundImage: `url(${active.url})`,
            backgroundSize: "200%",
            ...zoomStyle,
          }}
          className="pointer-events-none absolute inset-0 hidden bg-no-repeat opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:block"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto sm:w-20 sm:flex-col sm:overflow-y-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-md border-2 sm:w-full",
                index === activeIndex ? "border-primary" : "border-transparent",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
