"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PanelNavItem = { href: string; label: string; icon: ReactNode; badge?: number; exact?: boolean };
export type PanelNavGroup = { title?: string; items: PanelNavItem[] };

const isActive = (pathname: string, item: PanelNavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

/**
 * Navegação de painéis (conta, vendedor, admin). Desktop: menu lateral
 * agrupado. Mobile: faixa horizontal rolável com o item ativo visível.
 */
export function PanelNav({ groups, label, tone = "light" }: { groups: PanelNavGroup[]; label: string; tone?: "light" | "dark" }) {
  const pathname = usePathname();
  const flat = groups.flatMap((g) => g.items);
  const dark = tone === "dark";

  return (
    <nav aria-label={label}>
      {/* Mobile */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none lg:hidden">
        {flat.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                ref={(el) => {
                  if (active && el) el.scrollIntoView({ block: "nearest", inline: "center" });
                }}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap focus-ring [&_svg]:size-4",
                  active ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-surface text-fg-muted hover:border-brand-300 hover:text-brand-800",
                )}
              >
                {item.icon}
                {item.label}
                {item.badge ? <span className={cn("rounded-full px-1.5 text-2xs font-bold", active ? "bg-white text-brand-800" : "bg-coral-500 text-white")}>{item.badge > 99 ? "99+" : item.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Desktop */}
      <div className="hidden flex-col gap-5 lg:flex">
        {groups.map((group, gi) => (
          <div key={group.title ?? gi}>
            {group.title ? <p className={cn("mb-1.5 px-3 text-2xs font-bold tracking-wider uppercase", dark ? "text-white/50" : "text-fg-subtle")}>{group.title}</p> : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-field px-3 text-sm font-medium transition-colors focus-ring [&_svg]:size-[18px] [&_svg]:shrink-0",
                        dark
                          ? active
                            ? "bg-white/12 font-semibold text-white"
                            : "text-white/75 hover:bg-white/8 hover:text-white"
                          : active
                            ? "bg-brand-50 font-semibold text-brand-800 [&_svg]:text-brand-700"
                            : "text-fg-muted hover:bg-surface-muted hover:text-fg",
                      )}
                    >
                      {item.icon}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? <span className="rounded-full bg-coral-500 px-1.5 py-px text-2xs font-bold text-white">{item.badge > 99 ? "99+" : item.badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
