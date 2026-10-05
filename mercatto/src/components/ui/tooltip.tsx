"use client";

import { useId, useState, type ReactElement, type ReactNode } from "react";
import { cloneElement } from "react";
import { cn } from "@/lib/utils";

/** Tooltip leve (hover + foco), anunciado via aria-describedby. */
export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactElement<{ "aria-describedby"?: string }>; side?: "top" | "bottom" }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {cloneElement(children, { "aria-describedby": id })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-60 -translate-x-1/2 rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium text-white shadow-popover transition-opacity duration-150",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          open ? "opacity-100" : "opacity-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}
