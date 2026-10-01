import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Rótulo acessível (obrigatório: o botão só tem ícone). */
  label: string;
  tone?: 'default' | 'light' | 'glass' | 'primary';
  size?: 'sm' | 'md' | 'lg';
}

const tones = {
  default: 'bg-white text-ink-900 shadow-[var(--shadow-ring)] hover:bg-cream-100',
  light: 'text-ink-700 hover:bg-ink-900/[0.06] hover:text-ink-900',
  glass: 'bg-ink-950/45 text-white backdrop-blur-md hover:bg-ink-950/60',
  primary: 'bg-tomato-500 text-white hover:bg-tomato-600 shadow-[0_6px_16px_-6px_rgb(227_27_44/0.7)]',
};

const sizes = { sm: 'size-8', md: 'size-10', lg: 'size-12' };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'default', size = 'md', className, type = 'button', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato-500 active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        tones[tone],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
