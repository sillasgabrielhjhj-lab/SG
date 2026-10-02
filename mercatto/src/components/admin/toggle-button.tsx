"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function ToggleButton({
  action,
  id,
  children,
  variant = "outline",
}: {
  action: (id: string) => Promise<void>;
  id: string;
  children: ReactNode;
  variant?: "outline" | "destructive" | "ghost";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await action(id);
          router.refresh();
        })
      }
    >
      {children}
    </Button>
  );
}
