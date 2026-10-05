"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { toggleFavoriteStoreAction } from "@/features/wishlist/actions";

export function FollowStoreButton({ storeId, initial }: { storeId: string; initial: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  return (
    <Button
      variant={following ? "secondary" : "outline"}
      loading={pending}
      leftIcon={<Heart className="size-4" fill={following ? "currentColor" : "none"} />}
      onClick={() =>
        start(async () => {
          const res = await toggleFavoriteStoreAction({ storeId });
          if (!res.ok) {
            if (res.code === "UNAUTHENTICATED") return router.push(`/entrar?redirect=${encodeURIComponent(pathname)}`);
            return toast.error(res.error);
          }
          setFollowing(res.data.favorited);
          toast.success(res.message ?? "Pronto!");
        })
      }
    >
      {following ? "Seguindo" : "Seguir loja"}
    </Button>
  );
}
