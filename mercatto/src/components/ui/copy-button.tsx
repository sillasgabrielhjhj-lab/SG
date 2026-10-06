"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";

export function CopyButton({ value, label = "Copiar", copiedLabel = "Copiado!", onCopied, ...props }: Omit<ButtonProps, "onClick"> & { value: string; label?: string; copiedLabel?: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      {...props}
      onClick={async () => {
        if (!(await copyText(value))) return;
        setCopied(true);
        onCopied?.();
        window.setTimeout(() => setCopied(false), 2000);
      }}
      leftIcon={copied ? <Check className="size-4 animate-check" /> : <Copy className="size-4" />}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
