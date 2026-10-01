import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'dark' | 'outline' | 'outline-light' | 'ghost' | 'whatsapp' | 'light';
type Size = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-[-0.01em] transition-[background-color,color,box-shadow,transform,border-color] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
    'bg-tomato-500 text-white shadow-[0_8px_24px_-10px_rgb(227_27_44/0.7)] hover:bg-tomato-600 hover:shadow-[0_12px_28px_-10px_rgb(227_27_44/0.75)] focus-visible:outline-tomato-500',
  dark: 'bg-ink-900 text-cream-50 hover:bg-ink-700 focus-visible:outline-ink-900',
  outline:
    'border border-ink-900/15 bg-transparent text-ink-900 hover:border-ink-900/30 hover:bg-ink-900/[0.04] focus-visible:outline-ink-900',
  'outline-light':
    'border border-cream-50/25 bg-transparent text-cream-50 hover:border-cream-50/50 hover:bg-cream-50/[0.06] focus-visible:outline-cream-50',
  ghost: 'text-ink-700 hover:bg-ink-900/[0.05] hover:text-ink-900 focus-visible:outline-ink-900',
  whatsapp:
    'bg-basil-500 text-white shadow-[0_8px_24px_-10px_rgb(0_130_74/0.7)] hover:bg-basil-600 focus-visible:outline-basil-500',
  light: 'bg-cream-50 text-ink-900 hover:bg-white focus-visible:outline-cream-50',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[0.9375rem]',
  lg: 'h-13 px-7 text-base',
};

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonStyles({ variant, size, className })} {...props} />;
});

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size };

export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <a className={buttonStyles({ variant, size, className })} {...props} />;
}
