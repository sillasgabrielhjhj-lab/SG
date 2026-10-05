"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Compartilhar via Web Share API, com fallback para copiar o link. */
export function ShareButton({ title, url, className }: { title: string; url?: string; className?: string }) {
  const toast = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      leftIcon={<Share2 className="size-4" />}
      onClick={async () => {
        const link = url ?? window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url: link });
            return;
          } catch {
            /* cancelado pelo usuário */
            return;
          }
        }
        try {
          await navigator.clipboard.writeText(link);
          toast.success("Link copiado!", { description: "Agora é só colar onde quiser." });
        } catch {
          toast.error("Não foi possível copiar o link.");
        }
      }}
    >
      Compartilhar
    </Button>
  );
}
