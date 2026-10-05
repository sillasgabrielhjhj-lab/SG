"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function CopyButton({ value, label = "Copiar", copiedLabel = "Copiado!", ...props }: Omit<ButtonProps, "onClick"> & { value: string; label?: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      {...props}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      leftIcon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
