"use client";

import { ArrowLeft, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { btn } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/#conheca-tobias", label: "Conheça Tobias" },
  { href: "/#fotos", label: "Fotos" },
  { href: "/#como-ajudar", label: "Como Ajudar" },
];

export function SiteHeader({ variant = "home" }: { variant?: "home" | "donate" }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      className="sticky top-0 z-50 border-b border-brand-100/80 bg-white/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-[4.5rem]">
        <Logo className="max-sm:text-[1.05rem]" />

        {variant === "home" ? (
          <>
            <nav aria-label="Principal" className="hidden items-center gap-9 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative text-[0.95rem] font-semibold text-brand-900/80 transition after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-brand-500 after:transition after:duration-300 hover:text-brand-700 hover:after:scale-x-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-1.5">
              <Link
                href="/doar"
                className={btn({
                  size: "sm",
                  className: "shine max-sm:h-9 max-sm:px-3.5 max-sm:text-xs",
                })}
              >
                DOAR AGORA
              </Link>
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="menu-mobile"
                aria-label={open ? "Fechar menu" : "Abrir menu"}
                className="grid size-10 place-items-center rounded-full text-brand-900 transition hover:bg-brand-100/70 md:hidden"
              >
                {open ? (
                  <X aria-hidden className="size-6" />
                ) : (
                  <Menu aria-hidden className="size-6" />
                )}
              </button>
            </div>
          </>
        ) : (
          <Link
            href="/"
            aria-label="Voltar à campanha"
            className={btn({ variant: "secondary", size: "sm", className: "whitespace-nowrap" })}
          >
            <ArrowLeft aria-hidden className="size-4" />
            <span className="sm:hidden">Voltar</span>
            <span className="hidden sm:inline">Voltar à campanha</span>
          </Link>
        )}
      </div>

      {variant === "home" && open ? (
        <nav
          id="menu-mobile"
          aria-label="Menu"
          className="animate-pop border-t border-brand-100 bg-white px-4 pt-2 pb-4 md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3.5 text-lg font-semibold text-brand-900 transition hover:bg-brand-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
