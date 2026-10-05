"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DropdownItem =
  | { type: "link"; label: ReactNode; href: string; icon?: ReactNode }
  | { type: "button"; label: ReactNode; onSelect: () => void; icon?: ReactNode; danger?: boolean }
  | { type: "separator" }
  | { type: "custom"; node: ReactNode };

/** Menu suspenso WAI-ARIA: setas, Home/End, ESC, clique fora. */
export function DropdownMenu({ trigger, items, align = "end", label, className, header }: { trigger: (props: { open: boolean }) => ReactNode; items: DropdownItem[]; align?: "start" | "end"; label: string; className?: string; header?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const focusItem = useCallback((index: number) => {
    const els = menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]");
    if (!els?.length) return;
    els[(index + els.length) % els.length]?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    requestAnimationFrame(() => focusItem(0));
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, focusItem]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const index = els.indexOf(document.activeElement as HTMLElement);
    const target = e.key === "ArrowDown" ? index + 1 : e.key === "ArrowUp" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? els.length - 1 : null;
    if (target !== null) {
      e.preventDefault();
      focusItem(target);
    } else if (e.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "Tab") setOpen(false);
  };

  const itemClass = "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-fg outline-none hover:bg-surface-muted focus-visible:bg-brand-50 focus-visible:text-brand-800";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="rounded-field focus-ring"
      >
        {trigger({ open })}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cn("absolute top-full z-50 mt-2 w-64 origin-top animate-scale-in rounded-card border border-line bg-surface p-1.5 text-fg shadow-popover", align === "end" ? "right-0" : "left-0")}
        >
          {header}
          {items.map((item, i) => {
            if (item.type === "separator") return <div key={i} role="separator" className="my-1 h-px bg-line" />;
            if (item.type === "custom") return <div key={i}>{item.node}</div>;
            if (item.type === "link")
              return (
                <Link key={i} href={item.href} role="menuitem" tabIndex={-1} className={itemClass} onClick={() => setOpen(false)}>
                  {item.icon ? <span className="text-fg-subtle [&_svg]:size-4">{item.icon}</span> : null}
                  {item.label}
                </Link>
              );
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={cn(itemClass, item.danger && "text-danger-700 hover:bg-danger-50")}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon ? <span className="[&_svg]:size-4">{item.icon}</span> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
