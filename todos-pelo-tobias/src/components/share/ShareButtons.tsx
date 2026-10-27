"use client";

import { Link2 } from "lucide-react";
import { useState } from "react";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/cn";
import { buildShareMessage, facebookShareUrl, whatsappShareUrl } from "@/lib/share";

const item =
  "inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-white px-5 text-[0.95rem] font-bold text-brand-900 ring-1 ring-brand-200 transition duration-200 hover:-translate-y-0.5 hover:bg-brand-50 hover:shadow-soft active:scale-[0.98]";

/** WhatsApp, Facebook, Instagram (compartilhamento nativo do celular) e copiar link. */
export function ShareButtons({ url, className }: { url: string; className?: string }) {
  const [feedback, setFeedback] = useState("");
  const message = buildShareMessage(url);

  const flash = (text: string) => {
    setFeedback(text);
    window.setTimeout(() => setFeedback(""), 4000);
  };

  async function copyLink() {
    flash((await copyToClipboard(url)) ? "Link copiado! Agora é só colar onde quiser." : "Não foi possível copiar. Copie o endereço na barra do navegador.");
  }

  // O Instagram não tem link de compartilhamento para a web. No celular usamos a folha de
  // compartilhamento do sistema (onde o Instagram aparece); no computador, copiamos o link.
  async function shareInstagram() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Todos pelo Tobias", text: message, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    flash(
      (await copyToClipboard(url))
        ? "Link copiado! Cole no Instagram: na bio, nos Stories ou em uma mensagem."
        : "Não foi possível copiar. Copie o endereço na barra do navegador.",
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap justify-center gap-3">
        <a href={whatsappShareUrl(message)} target="_blank" rel="noopener noreferrer" className={item}>
          <WhatsAppIcon className="size-5 text-[#128c7e]" />
          WhatsApp
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        <a href={facebookShareUrl(url)} target="_blank" rel="noopener noreferrer" className={item}>
          <FacebookIcon className="size-5 text-[#1877f2]" />
          Facebook
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        <button type="button" onClick={() => void shareInstagram()} className={item}>
          <InstagramIcon className="size-5 text-[#c13584]" />
          Instagram
        </button>
        <button type="button" onClick={() => void copyLink()} className={item}>
          <Link2 aria-hidden className="size-5 text-brand-700" />
          Copiar link
        </button>
      </div>
      <p role="status" aria-live="polite" className={cn("mt-3 min-h-6 text-center text-sm font-medium text-brand-800")}>
        {feedback}
      </p>
    </div>
  );
}
