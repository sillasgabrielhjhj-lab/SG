import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  eyebrow,
  title,
  children,
  align = "center",
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  align?: "center" | "left";
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      <p
        className={cn(
          "inline-flex items-center gap-3 text-xs font-bold tracking-[0.22em] text-petal-700 uppercase",
          align === "center" && "justify-center",
        )}
      >
        <span aria-hidden className="h-px w-8 bg-petal-300" />
        {eyebrow}
        {align === "center" ? <span aria-hidden className="h-px w-8 bg-petal-300" /> : null}
      </p>
      <h2
        id={id}
        className="mt-4 text-[2rem] leading-[1.12] font-semibold text-ink sm:text-4xl lg:text-[2.75rem]"
      >
        {title}
      </h2>
      {children ? <p className="mt-4 text-lg leading-relaxed text-muted">{children}</p> : null}
    </div>
  );
}
