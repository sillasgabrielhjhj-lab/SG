"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { resendVerificationAction } from "@/features/auth/actions";

export function ResendVerificationButton() {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await resendVerificationAction();
          if (res.ok) toast.success(res.message ?? "Link enviado.");
          else toast.error(res.error);
        })
      }
    >
      Reenviar link
    </Button>
  );
}
