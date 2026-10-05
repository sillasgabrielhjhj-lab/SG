"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { toggleWishlistAction } from "@/features/wishlist/actions";

/** Coração de favoritos com atualização otimista. Visitante => /entrar. */
export function FavoriteButton({ productId, initial = false, className, size = "md" }: { productId: string; initial?: boolean; className?: string; size?: "sm" | "md" }) {
  const [favorited, setFavorited] = useState(initial);
  const [animate, setAnimate] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !favorited;
        setFavorited(next);
        if (next) setAnimate(true);
        start(async () => {
          const res = await toggleWishlistAction({ productId });
          if (!res.ok) {
            setFavorited(!next);
            if (res.code === "UNAUTHENTICATED") {
              router.push(`/entrar?redirect=${encodeURIComponent(pathname)}`);
              return;
            }
            toast.error(res.error);
            return;
          }
          setFavorited(res.data.favorited);
          if (res.data.favorited) toast.success("Adicionado aos favoritos", { action: { label: "Ver favoritos", onClick: () => router.push("/minha-conta/favoritos") } });
        });
      }}
      onAnimationEnd={() => setAnimate(false)}
      className={cn(
        "grid place-items-center rounded-full bg-surface/90 text-fg-muted shadow-sm ring-1 ring-line backdrop-blur-sm transition-colors hover:text-coral-600 focus-ring",
        size === "sm" ? "size-8" : "size-10",
        favorited && "text-coral-600",
        animate && "animate-pop",
        className,
      )}
    >
      <Heart className={size === "sm" ? "size-4" : "size-5"} fill={favorited ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
