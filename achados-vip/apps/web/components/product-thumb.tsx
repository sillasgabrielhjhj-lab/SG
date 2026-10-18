'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { safeHref } from '@/lib/format';

/** Miniatura de produto (imagem externa; sem referrer). Sem imagem/erro ao carregar ⇒ placeholder neutro, nunca imagem inventada. */
export function ProductThumb({ src, alt = '', size = 48, className }: { src: string | null | undefined; alt?: string; size?: number; className?: string }) {
  const href = safeHref(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [href]);
  const style = { width: size, height: size };
  if (!href || failed) {
    return (
      <span style={style} className={cn('grid shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-muted', className)} role={alt ? 'img' : undefined} aria-label={alt ? `${alt} (sem imagem)` : undefined}>
        <Icon name="tag" size={Math.round(size / 2.5)} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={href}
      alt={alt}
      style={style}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-lg border border-line bg-white object-contain', className)}
    />
  );
}
