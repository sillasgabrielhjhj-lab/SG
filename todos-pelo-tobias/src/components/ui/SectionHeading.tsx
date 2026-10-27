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
      <p className="text-sm font-bold tracking-[0.18em] text-brand-700 uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl font-extrabold text-brand-950 sm:text-4xl lg:text-[2.6rem] lg:leading-[1.1]">
        {title}
      </h2>
      {children ? <p className="mt-4 text-lg leading-relaxed text-muted">{children}</p> : null}
    </div>
  );
}
