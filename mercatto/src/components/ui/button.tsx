import Link from "next/link";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "sun" | "link" | "inverse";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-field font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900",
  secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200",
  outline: "border border-line-strong bg-surface text-fg hover:border-brand-600 hover:text-brand-800 active:bg-brand-50",
  ghost: "text-fg-muted hover:bg-surface-muted hover:text-fg active:bg-line",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
  sun: "bg-sun-400 text-sun-900 shadow-sm hover:bg-sun-300 active:bg-sun-500",
  link: "h-auto px-0 text-brand-700 underline-offset-4 hover:underline active:scale-100",
  inverse: "bg-white text-brand-900 hover:bg-brand-50",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "size-11",
  "icon-sm": "size-9",
};

export function buttonClasses(opts: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}) {
  const { variant = "primary", size = "md", fullWidth, className } = opts;
  return cn(base, variants[variant], variant !== "link" && sizes[size], fullWidth && "w-full", className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export type ButtonProps = ComponentProps<"button"> & CommonProps & { loading?: boolean; loadingText?: string };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, leftIcon, rightIcon, loading, loadingText, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" label={loadingText ?? "Processando"} /> : leftIcon}
      {loading && loadingText ? loadingText : children}
      {!loading && rightIcon}
    </button>
  );
});

export type ButtonLinkProps = ComponentProps<typeof Link> & CommonProps;

export function ButtonLink({ variant, size, fullWidth, leftIcon, rightIcon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}

export type IconButtonProps = Omit<ButtonProps, "children" | "leftIcon" | "rightIcon"> & { "aria-label": string; icon: ReactNode };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ icon, size = "icon", variant = "ghost", ...props }, ref) {
  return (
    <Button ref={ref} size={size} variant={variant} {...props}>
      {icon}
    </Button>
  );
});
