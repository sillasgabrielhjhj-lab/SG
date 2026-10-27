"use client";

import { Check, Copy } from "lucide-react";
import { btn, type ButtonStyleOptions } from "@/components/ui/button";
import { useCopy } from "@/hooks/useCopy";

interface CopyButtonProps extends ButtonStyleOptions {
  text: string;
  label?: string;
  copiedLabel?: string;
  /** Texto exibido se o navegador impedir a cópia automática. */
  failureHint?: string;
}

export function CopyButton({
  text,
  label = "Copiar código Pix",
  copiedLabel = "Código copiado!",
  failureHint = "Não foi possível copiar automaticamente. Toque no texto, selecione tudo e copie.",
  variant = "primary",
  size = "lg",
  className,
}: CopyButtonProps) {
  const { status, copy } = useCopy();
  const copied = status === "copied";

  return (
    <>
      <button
        type="button"
        onClick={() => void copy(text)}
        data-state={status}
        className={btn({ variant: copied ? "success" : variant, size, className })}
      >
        {copied ? (
          <Check aria-hidden className="size-5 animate-pop" />
        ) : (
          <Copy aria-hidden className="size-5" />
        )}
        <span>{copied ? copiedLabel : label}</span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copiado para a área de transferência." : ""}
      </span>
      {status === "failed" ? (
        <p role="alert" className="mt-3 text-center text-sm font-medium text-red-700">
          {failureHint}
        </p>
      ) : null}
    </>
  );
}
