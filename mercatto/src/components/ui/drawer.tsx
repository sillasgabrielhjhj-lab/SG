"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Painel lateral (desktop/mobile) ou folha inferior (mobile), sobre <dialog> nativo. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = "right",
  className,
  widthClass = "w-[min(420px,92vw)]",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right" | "bottom";
  className?: string;
  widthClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) dialog.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const position =
    side === "left"
      ? cn("mr-auto ml-0 h-dvh max-h-dvh rounded-r-panel open:animate-drawer-left", widthClass)
      : side === "right"
        ? cn("mr-0 ml-auto h-dvh max-h-dvh rounded-l-panel open:animate-drawer-right", widthClass)
        : "mx-auto mt-auto mb-0 max-h-[88dvh] w-full max-w-none rounded-t-panel open:animate-sheet-up";

  return (
    <dialog
      ref={ref}
      onClose={() => {
        document.documentElement.style.overflow = "";
        onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="drawer-title"
      className={cn("max-w-none overflow-hidden bg-surface p-0 text-fg shadow-popover backdrop:animate-fade-in", position, className)}
    >
      {open ? (
        <div className={cn("flex flex-col", side === "bottom" ? "max-h-[88dvh]" : "h-full")}>
          {side === "bottom" ? <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden /> : null}
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id="drawer-title" className="text-base font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full text-fg-muted hover:bg-surface-muted hover:text-fg focus-ring" aria-label="Fechar">
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer ? <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
