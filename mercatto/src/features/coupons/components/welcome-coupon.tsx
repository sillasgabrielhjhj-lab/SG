"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";
import type { WelcomeCampaignView } from "@/features/coupons/campaign.server";

const loadModal = () => import("@/features/coupons/components/welcome-coupon-modal");
const WelcomeCouponModal = dynamic(loadModal, { ssr: false });

const SEEN_KEY = "mercatto_welcome_coupon_seen";
const TAB_HIDDEN_KEY = "mercatto_coupon_tab_hidden";
const OPEN_DELAY_MS = 1600;
const DAY_MS = 86_400_000;

/** Onde o pop-up não abre sozinho (área do cliente, carrinho e a própria página do cupom). */
const NO_AUTO_OPEN = /^\/(minha-conta|carrinho|cupom)(\/|$)/;
/** Onde nem a aba flutuante aparece. */
const NO_TAB = /^\/(minha-conta|cupom)(\/|$)/;

type Seen = { code: string; at: number };

function readSeen(): Seen | null {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Seen>) : null;
    return parsed && typeof parsed.code === "string" && typeof parsed.at === "number" ? { code: parsed.code, at: parsed.at } : null;
  } catch {
    return null;
  }
}

function markSeen(code: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ code, at: Date.now() } satisfies Seen));
  } catch {
    /* modo privado/sem storage: o pop-up só não "lembra" */
  }
}

function tabHiddenThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(TAB_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Controla o pop-up de boas-vindas e a aba flutuante ("25% OFF · 1ª compra"):
 *  - abre uma vez (após a página carregar), e só volta depois de `reshowDays`
 *    dias ou se o cupom da campanha mudar;
 *  - fechado o pop-up, fica a aba discreta para reabrir os detalhes;
 *  - o código do pop-up só é baixado quando ele vai aparecer.
 */
export function WelcomeCoupon({ campaign }: { campaign: WelcomeCampaignView | null }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "modal" | "tab" | "off">("idle");

  useEffect(() => {
    if (!campaign || phase !== "idle") return;
    const seen = readSeen();
    const due = !seen || seen.code !== campaign.code || Date.now() - seen.at > campaign.reshowDays * DAY_MS;
    if (!due || NO_AUTO_OPEN.test(pathname)) {
      const t = window.setTimeout(() => setPhase(tabHiddenThisSession() ? "off" : "tab"), 0);
      return () => window.clearTimeout(t);
    }
    // Espera a página assentar (não disputa com LCP/interação inicial).
    const t = window.setTimeout(() => {
      void loadModal().then(() => setPhase((p) => (p === "idle" ? "modal" : p)));
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [campaign, pathname, phase]);

  if (!campaign || phase === "idle" || phase === "off") return null;

  if (phase === "modal") {
    return (
      <WelcomeCouponModal
        campaign={campaign}
        onClose={() => {
          markSeen(campaign.code);
          setPhase(tabHiddenThisSession() ? "off" : "tab");
        }}
      />
    );
  }

  if (NO_TAB.test(pathname)) return null;
  return (
    <div data-coupon-tab className="fixed right-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-(--z-floating) flex animate-float-in items-center md:right-6 md:bottom-6">
      <button
        type="button"
        onClick={() => setPhase("modal")}
        aria-label={`Ver cupom de boas-vindas: ${campaign.headline} ${campaign.scopeLabel}`}
        className="press flex h-11 items-center gap-2 rounded-full bg-brand-800 pr-4 pl-3 text-sm font-extrabold text-white shadow-glow ring-1 ring-white/10 transition-colors hover:bg-brand-900 focus-ring"
      >
        <span className="grid size-7 animate-nudge place-items-center rounded-full bg-sun-400 text-sun-900">
          <Gift className="size-4" aria-hidden />
        </span>
        <span className="tabular">
          {campaign.headline}
          {campaign.firstPurchaseOnly ? <span className="font-semibold opacity-80"> · 1ª compra</span> : null}
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            window.sessionStorage.setItem(TAB_HIDDEN_KEY, "1");
          } catch {
            /* sem storage: some só nesta página */
          }
          setPhase("off");
        }}
        aria-label="Ocultar aba do cupom"
        className="press -ml-2 grid size-7 place-items-center rounded-full bg-surface text-fg-muted shadow-raised ring-1 ring-line hover:text-fg focus-ring"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
