import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Tabela com rolagem horizontal interna (nunca a página). */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-card border border-line bg-surface">
      <table className={cn("w-full min-w-[640px] border-collapse text-left text-sm", className)} {...props} />
    </div>
  );
}
export const THead = ({ className, ...p }: ComponentProps<"thead">) => <thead className={cn("bg-surface-muted text-xs font-semibold tracking-wide text-fg-muted uppercase", className)} {...p} />;
export const TBody = ({ className, ...p }: ComponentProps<"tbody">) => <tbody className={cn("divide-y divide-line", className)} {...p} />;
export const TR = ({ className, ...p }: ComponentProps<"tr">) => <tr className={cn("transition-colors hover:bg-surface-muted/60", className)} {...p} />;
export const TH = ({ className, ...p }: ComponentProps<"th">) => <th scope="col" className={cn("px-4 py-3 whitespace-nowrap", className)} {...p} />;
export const TD = ({ className, ...p }: ComponentProps<"td">) => <td className={cn("px-4 py-3 align-middle", className)} {...p} />;
