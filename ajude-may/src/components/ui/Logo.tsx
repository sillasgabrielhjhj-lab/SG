import { Heart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Ajude May — página inicial"
      className={cn(
        "inline-flex items-center gap-1.5 font-display text-[1.45rem] leading-none font-semibold tracking-tight whitespace-nowrap",
        light ? "text-white" : "text-ink",
        className,
      )}
    >
      <span>
        Ajude <em className={light ? "text-petal-300" : "text-petal-600"}>May</em>
      </span>
      <Heart aria-hidden className="size-[1.05rem] animate-beat fill-heart text-heart" />
    </Link>
  );
}
