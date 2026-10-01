'use client';

import { CakeSlice, CupSoda, ImageIcon, Pizza, Package } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export type FallbackKind = 'pizza' | 'drink' | 'dessert' | 'combo' | 'image';

const fallbackIcons = {
  pizza: Pizza,
  drink: CupSoda,
  dessert: CakeSlice,
  combo: Package,
  image: ImageIcon,
};

interface SmartImageProps {
  src?: string;
  alt: string;
  /** Classes do container (defina tamanho/proporção/arredondamento aqui). */
  className?: string;
  imgClassName?: string;
  sizes: string;
  quality?: number;
  /** Para a imagem principal (LCP): carrega com prioridade e sem fade. */
  priority?: boolean;
  fallback?: FallbackKind;
  /** Tom do placeholder quando não há foto. */
  tone?: 'cream' | 'tomato' | 'basil' | 'dark';
  /** Fundo neutro atrás da foto enquanto carrega (desligue em fundos escuros). */
  background?: boolean;
}

const tones = {
  cream: 'bg-cream-200 text-ink-400',
  tomato: 'bg-tomato-50 text-tomato-400',
  basil: 'bg-basil-50 text-basil-400',
  dark: 'bg-ink-800 text-ink-500',
};

/**
 * Imagem otimizada com:
 * - skeleton enquanto carrega e fade-in suave;
 * - placeholder elegante se não houver foto ou se ela falhar.
 */
export function SmartImage({
  src,
  alt,
  className,
  imgClassName,
  sizes,
  quality = 70,
  priority = false,
  fallback = 'image',
  tone = 'cream',
  background = true,
}: SmartImageProps) {
  const [state, setState] = useState<{ src?: string; status: 'loading' | 'loaded' | 'error' }>({
    src,
    status: 'loading',
  });
  const status = state.src === src ? state.status : 'loading';
  const Icon = fallbackIcons[fallback];

  const showFallback = !src || status === 'error';

  return (
    <div className={cn('relative overflow-hidden', showFallback ? tones[tone] : background && 'bg-cream-200', className)}>
      {showFallback ? (
        <div className="absolute inset-0 flex items-center justify-center" role="img" aria-label={alt}>
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:14px_14px]"
          />
          <Icon className="relative size-[28%] max-h-14 max-w-14 stroke-[1.25]" aria-hidden />
        </div>
      ) : (
        <>
          {status === 'loading' && !priority && background && <div aria-hidden className="skeleton absolute inset-0" />}
          <Image
            ref={(img) => {
              // Erro antes da hidratação (o React não dispara onError nesse caso).
              if (img && img.complete && img.naturalWidth === 0 && status === 'loading') {
                setState({ src, status: 'error' });
              }
            }}
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            quality={quality}
            preload={priority}
            fetchPriority={priority ? 'high' : undefined}
            onLoad={() => setState({ src, status: 'loaded' })}
            onError={() => setState({ src, status: 'error' })}
            className={cn(
              'object-cover',
              !priority && 'transition-opacity duration-500 ease-out',
              !priority && status !== 'loaded' && 'opacity-0',
              imgClassName,
            )}
          />
        </>
      )}
    </div>
  );
}
