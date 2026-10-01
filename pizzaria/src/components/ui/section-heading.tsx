import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  className?: string;
  as?: 'h1' | 'h2';
}

/** Título padrão das seções: "olho" + título em serifa + descrição opcional. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'light',
  className,
  as: Tag = 'h2',
}: SectionHeadingProps) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      <p
        className={cn(
          'mb-4 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em]',
          tone === 'light' ? 'text-tomato-600' : 'text-tomato-300',
        )}
      >
        <span aria-hidden className="h-px w-8 bg-current opacity-60" />
        {eyebrow}
      </p>
      <Tag
        id={id}
        className={cn(
          'text-display text-[2.25rem] leading-[1.05] font-medium sm:text-5xl lg:text-[3.5rem]',
          tone === 'light' ? 'text-ink-900' : 'text-cream-50',
        )}
      >
        {title}
      </Tag>
      {description && (
        <p
          className={cn(
            'mt-5 text-base leading-relaxed sm:text-lg',
            tone === 'light' ? 'text-ink-500' : 'text-cream-100/70',
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

/** Palavra de destaque em itálico dentro dos títulos. */
export function Accent({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <em className={cn('font-normal italic', tone === 'light' ? 'text-tomato-600' : 'text-tomato-400')}>{children}</em>
  );
}
