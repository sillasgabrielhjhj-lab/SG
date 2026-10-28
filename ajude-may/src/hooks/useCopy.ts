"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

export type CopyStatus = "idle" | "copied" | "failed";

/** Copia texto e informa o resultado por alguns segundos (para o feedback visual do botão). */
export function useCopy(resetMs = 2800) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text);
      setStatus(ok ? "copied" : "failed");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus("idle"), resetMs);
      return ok;
    },
    [resetMs],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { status, copy };
}
