"use client";

import { Link2, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { FacebookIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/cn";
import {
  buildShareMessage,
  facebookShareUrl,
  nativeShareText,
  SHARE_TITLE,
  whatsappShareUrl,
} from "@/lib/share";

const item =
  "inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-white px-3 text-[0.95rem] font-bold text-ink ring-1 ring-petal-200 transition duration-200 hover:-translate-y-0.5 hover:bg-petal-50 hover:shadow-soft active:scale-[0.98] sm:w-auto sm:px-5";

const noSubscribe = () => () => {};

/** Abre a folha de compartilhamento do celular; devolve false se não existir ou falhar. */
export async function shareNatively(url: string): Promise<boolean | "cancelled"> {
  if (typeof navigator.share !== "function") return false;
  try {
    await navigator.share({ title: SHARE_TITLE, text: nativeShareText(), url });
    return true;
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError" ? "cancelled" : false;
  }
}

/** WhatsApp, Facebook, copiar link e, quando o aparelho permite, o compartilhamento nativo. */
export function ShareButtons({ url, className }: { url: string; className?: string }) {
  const [feedback, setFeedback] = useState("");
  const message = buildShareMessage(url);

  // no servidor é sempre false: o botão só aparece no navegador, se o aparelho permitir
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  const flash = (text: string) => {
    setFeedback(text);
    window.setTimeout(() => setFeedback(""), 4000);
  };

  async function copyLink() {
    flash(
      (await copyToClipboard(url))
        ? "Link copiado! Agora é só colar onde quiser."
        : "Não foi possível copiar. Copie o endereço na barra do navegador.",
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center">
        <a
          href={whatsappShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className={item}
        >
          <WhatsAppIcon className="size-5 text-[#128c7e]" />
          WhatsApp
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        <a href={facebookShareUrl(url)} target="_blank" rel="noopener noreferrer" className={item}>
          <FacebookIcon className="size-5 text-[#1877f2]" />
          Facebook
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        <button type="button" onClick={() => void copyLink()} className={item}>
          <Link2 aria-hidden className="size-5 text-petal-600" />
          Copiar link
        </button>
        {canShare ? (
          <button type="button" onClick={() => void shareNatively(url)} className={item}>
            <Share2 aria-hidden className="size-5 text-lilac-600" />
            Mais opções
          </button>
        ) : null}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn("mt-3 min-h-6 text-center text-sm font-medium text-petal-800")}
      >
        {feedback}
      </p>
    </div>
  );
}
