import { Heart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { campaign } from "@/config/campaign";

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label={`${campaign.name} — página inicial`}
      className={cn(
        "inline-flex items-center gap-1.5 font-display text-[1.35rem] leading-none font-extrabold tracking-tight",
        light ? "text-white" : "text-brand-900",
        className,
      )}
    >
      <span>
        Todos pelo <span className={light ? "text-brand-300" : "text-brand-600"}>Tobias</span>
      </span>
      <Heart aria-hidden className="size-[1.05rem] animate-beat fill-heart text-heart" />
    </Link>
  );
}
