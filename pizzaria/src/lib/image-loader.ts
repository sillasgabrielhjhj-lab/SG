'use client';

import type { ImageLoaderProps } from 'next/image';

/**
 * Loader de imagens:
 * - Fotos do Unsplash: redimensionadas e convertidas (AVIF/WebP) pela própria CDN.
 * - Arquivos locais (/public): servidos como estão, com o basePath aplicado.
 */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (src.startsWith('https://images.unsplash.com/')) {
    const url = new URL(src);
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'max');
    url.searchParams.set('w', String(width));
    url.searchParams.set('q', String(quality ?? 70));
    return url.toString();
  }

  if (src.startsWith('/')) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const path = src.startsWith(base) ? src : `${base}${src}`;
    return `${path}?w=${width}`;
  }

  return src;
}
