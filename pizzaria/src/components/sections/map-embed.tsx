'use client';

import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { siteConfig } from '@/config/site';

/** Mapa do Google carregado só quando chega perto da tela (não pesa o carregamento inicial). */
export function MapEmbed({ directionsUrl }: { directionsUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const src =
    siteConfig.address.mapsEmbedUrl ||
    `https://www.google.com/maps?q=${encodeURIComponent(siteConfig.address.mapsQuery)}&output=embed`;

  return (
    <div
      ref={ref}
      className="relative h-full min-h-[22rem] overflow-hidden rounded-[2rem] bg-cream-200 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/[0.06]"
    >
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-500">
          <span className="skeleton absolute inset-0" aria-hidden />
          <MapPin className="relative size-8 text-tomato-500" aria-hidden />
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="relative text-sm font-semibold underline">
            Open in Google Maps
          </a>
        </div>
      )}
      {visible && (
        <iframe
          title={`Map: ${siteConfig.name} location`}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 size-full border-0 grayscale-[35%]"
          allowFullScreen
        />
      )}
    </div>
  );
}
