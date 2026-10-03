import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 150 32"
      className={cn("h-7 w-auto", className)}
      role="img"
      aria-label="Mercatto"
    >
      <rect x="0" y="4" width="24" height="24" rx="7" fill="var(--color-primary)" />
      <path
        d="M6.5 20V12.4L10.4 17.6L14.3 12.4V20"
        stroke="var(--color-primary-foreground)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="18.4" cy="11.6" r="1.7" fill="var(--color-accent)" />
      <text
        x="31"
        y="22.5"
        fontFamily="var(--font-display)"
        fontWeight="700"
        fontSize="19"
        letterSpacing="-0.02em"
        fill="currentColor"
      >
        Mercatto
      </text>
    </svg>
  );
}
