"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";

type Result = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Executa uma Server Action com toast, erros de campo e refresh. */
export function useAdminAction() {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<Result>, onSuccess?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      toast.success(res.message ?? "Salvo.");
      onSuccess?.();
      router.refresh();
    });
  /** Erro do campo (as chaves vêm como "input.campo"). */
  const err = (field: string) => errors[`input.${field}`] ?? errors[field];
  return { pending, run, err, setErrors };
}
