import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "brand" | "sun" | "coral" | "success" | "warning" | "danger" | "info" | "outline" | "solid";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-fg-muted ring-1 ring-inset ring-line",
  brand: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200",
  sun: "bg-sun-300 text-sun-900",
  coral: "bg-coral-50 text-coral-700 ring-1 ring-inset ring-coral-200",
  success: "bg-success-50 text-success-700 ring-1 ring-inset ring-success-600/20",
  warning: "bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-600/25",
  danger: "bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-600/20",
  info: "bg-info-50 text-info-700 ring-1 ring-inset ring-info-600/20",
  outline: "bg-transparent text-fg-muted ring-1 ring-inset ring-line-strong",
  solid: "bg-brand-800 text-white",
};

export function Badge({ tone = "neutral", size = "sm", icon, className, children }: { tone?: BadgeTone; size?: "xs" | "sm" | "md"; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full font-semibold whitespace-nowrap",
        size === "xs" && "px-1.5 py-px text-2xs",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        tones[tone],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
