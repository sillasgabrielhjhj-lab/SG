import { cn } from "@/lib/cn";

const variants = {
  /** Verde: somente ações de doação. */
  donate:
    "bg-gradient-to-b from-sage-500 to-sage-600 text-white shadow-[0_14px_30px_-12px_rgb(35_123_78/0.7)] hover:-translate-y-0.5 hover:to-sage-700 hover:shadow-[0_18px_36px_-12px_rgb(35_123_78/0.75)]",
  success: "bg-gradient-to-b from-sage-700 to-sage-800 text-white shadow-soft",
  secondary: "bg-white text-petal-800 ring-1 ring-petal-200 hover:bg-petal-50 hover:ring-petal-300",
  soft: "bg-lilac-100 text-lilac-900 hover:bg-lilac-200",
  ghost: "text-petal-800 hover:bg-petal-100/70",
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
export function btn({ variant = "donate", size = "md", className }: ButtonStyleOptions = {}) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-bold tracking-wide transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );
}
