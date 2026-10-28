"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { shareNatively } from "@/components/share/ShareButtons";
import { btn } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";

/** Botão "Compartilhar" do card: folha nativa no celular; no computador, copia o link. */
export function ShareCampaignButton({ url }: { url: string }) {
  const [feedback, setFeedback] = useState("");

  async function share() {
    const result = await shareNatively(url);
    if (result) return;
    setFeedback(
      (await copyToClipboard(url))
        ? "Link copiado! Cole no WhatsApp ou onde quiser."
        : "Não foi possível copiar. Copie o endereço na barra do navegador.",
    );
    window.setTimeout(() => setFeedback(""), 4000);
  }

  return (
    // relative z-10: fica acima do link que cobre o card inteiro
    <div className="relative z-10 -mt-2">
      <button
        type="button"
        onClick={() => void share()}
        className={btn({ variant: "secondary", className: "w-full" })}
      >
        <Share2 aria-hidden className="size-4" />
        Compartilhar
      </button>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-5 text-center text-sm font-medium text-petal-800"
      >
        {feedback}
      </p>
    </div>
  );
}
