'use client';

import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Reveal } from '@/components/ui/reveal';
import { Accent, SectionHeading } from '@/components/ui/section-heading';
import { SmartImage } from '@/components/ui/smart-image';
import { gallery } from '@/data/gallery';
import { cn } from '@/lib/utils';

const layoutClass = {
  tall: 'row-span-2',
  wide: 'col-span-2',
  square: '',
};

export function Gallery() {
  const [index, setIndex] = useState<number | null>(null);

  return (
    <section id="galeria" aria-labelledby="galeria-title" className="bg-cream-100 py-20 lg:py-28">
      <div className="container-page">
        <SectionHeading
          id="galeria-title"
          eyebrow="Galeria"
          title={
            <>
              Um pouco do nosso <Accent>dia a dia.</Accent>
            </>
          }
          description="Pizzas saindo do forno, a cozinha em ação e o nosso cantinho."
        />

        <ul className="mt-12 grid auto-rows-[9.5rem] grid-flow-dense grid-cols-2 gap-3 sm:auto-rows-[12rem] md:grid-cols-4 md:gap-4 lg:auto-rows-[14rem]">
          {gallery.map((item, i) => (
            <Reveal as="li" key={item.id} delay={(i % 4) * 0.06} y={16} className={layoutClass[item.layout]}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className="group relative block size-full overflow-hidden rounded-2xl md:rounded-[1.5rem]"
                aria-label={`Ampliar foto: ${item.caption}`}
              >
                <SmartImage
                  src={item.src}
                  alt={item.alt}
                  sizes={item.layout === 'wide' ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 50vw'}
                  className="size-full"
                  imgClassName="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.06]"
                />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent opacity-80 transition-opacity group-hover:opacity-100" />
                <span className="pointer-events-none absolute right-3 bottom-3 left-3 flex items-center justify-between text-left text-sm font-semibold text-white md:right-4 md:bottom-4 md:left-4">
                  {item.caption}
                  <ZoomIn className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
              </button>
            </Reveal>
          ))}
        </ul>
      </div>

      <Lightbox index={index} onChange={setIndex} />
    </section>
  );
}

function Lightbox({ index, onChange }: { index: number | null; onChange: (i: number | null) => void }) {
  const [shown, setShown] = useState(index);
  if (index !== null && index !== shown) setShown(index);
  const item = shown !== null ? gallery[shown] : undefined;
  const touchStart = useRef<number | null>(null);
  const count = gallery.length;

  const go = (delta: number) => {
    if (index === null) return;
    onChange((index + delta + count) % count);
  };

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onChange((index + 1) % count);
      if (e.key === 'ArrowLeft') onChange((index - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, onChange]);

  return (
    <Dialog open={index !== null} onClose={() => onChange(null)} variant="fullscreen" label="Galeria de fotos">
      {item && (
        <div
          className="flex h-full flex-col text-cream-50"
          onTouchStart={(e) => (touchStart.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            const end = e.changedTouches[0]?.clientX;
            if (start !== null && end !== undefined && Math.abs(end - start) > 50) go(end < start ? 1 : -1);
            touchStart.current = null;
          }}
        >
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <p className="text-sm text-cream-50/70" aria-live="polite">
              {(shown ?? 0) + 1} / {count}
            </p>
            <IconButton label="Fechar galeria" tone="glass" onClick={() => onChange(null)} data-autofocus>
              <X className="size-5" aria-hidden />
            </IconButton>
          </div>
          <div className="relative min-h-0 flex-1 px-4 sm:px-20">
            <SmartImage
              key={item.id}
              src={item.src}
              alt={item.alt}
              sizes="100vw"
              quality={80}
              className="size-full"
              imgClassName="!object-contain"
              background={false}
              tone="dark"
            />
            <IconButton
              label="Foto anterior"
              tone="glass"
              size="lg"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-3 -translate-y-1/2 max-sm:hidden"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </IconButton>
            <IconButton
              label="Próxima foto"
              tone="glass"
              size="lg"
              onClick={() => go(1)}
              className="absolute top-1/2 right-3 -translate-y-1/2 max-sm:hidden"
            >
              <ChevronRight className="size-6" aria-hidden />
            </IconButton>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-5 pb-safe">
            <IconButton label="Foto anterior" tone="glass" onClick={() => go(-1)} className="sm:hidden">
              <ChevronLeft className="size-5" aria-hidden />
            </IconButton>
            <p className="text-display flex-1 text-center text-xl">{item.caption}</p>
            <IconButton label="Próxima foto" tone="glass" onClick={() => go(1)} className={cn('sm:hidden')}>
              <ChevronRight className="size-5" aria-hidden />
            </IconButton>
          </div>
        </div>
      )}
    </Dialog>
  );
}
