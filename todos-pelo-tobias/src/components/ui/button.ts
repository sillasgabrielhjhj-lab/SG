import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-[0_12px_30px_-12px_rgb(27_106_67/0.75)] hover:-translate-y-0.5 hover:to-brand-800 hover:shadow-[0_18px_36px_-12px_rgb(27_106_67/0.8)]",
  success:
    "bg-gradient-to-b from-brand-800 to-brand-900 text-white shadow-[0_12px_30px_-12px_rgb(19_68_48/0.8)]",
  secondary: "bg-white text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50 hover:ring-brand-300",
  ghost: "text-brand-800 hover:bg-brand-100/70",
} as const;

const sizes = {
  sm: "h-10 px-5 text-sm",
  md: "h-12 px-6 text-[0.95rem]",
  lg: "h-14 px-7 text-base sm:px-9 sm:text-[1.05rem]",
} as const;

export interface ButtonStyleOptions {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}

/** Classes dos botões do site (usadas em <Link>, <a> e <button>). */
export function btn({ variant = "primary", size = "md", className }: ButtonStyleOptions = {}) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-bold tracking-wide transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );
}
