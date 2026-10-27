import { Camera, Heart } from "lucide-react";
import Image from "next/image";
import type { Photo } from "@/content/photos";
import { cn } from "@/lib/cn";

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, #def3e6 0%, #fbf8f1 100%)",
  "linear-gradient(160deg, #fdeeee 0%, #def3e6 100%)",
  "linear-gradient(120deg, #bde6cd 0%, #f2faf5 100%)",
  "linear-gradient(145deg, #fbf8f1 0%, #bde6cd 100%)",
  "linear-gradient(135deg, #f2faf5 0%, #fdeeee 100%)",
  "linear-gradient(170deg, #8fd3ac 0%, #def3e6 100%)",
];

interface PhotoFrameProps {
  photo: Photo;
  /** Posição na lista (varia a cor do espaço reservado). */
  index?: number;
  /** Atributo `sizes` do next/image, para entregar a imagem no tamanho certo. */
  sizes: string;
  priority?: boolean;
  fit?: "cover" | "contain";
  /** Miniaturas: mostra só o coração, sem o rótulo "Foto do Tobias em breve". */
  compact?: boolean;
  /** Use dentro de links/botões que já têm nome acessível (evita nome duplicado ou conflitante). */
  decorative?: boolean;
  className?: string;
}

/**
 * Preenche 100% do elemento pai (que precisa ser `relative` e ter tamanho). Mostra a foto real do
 * Tobias ou, enquanto não houver `src`, um espaço reservado discreto (nunca uma foto de terceiros).
 */
export function PhotoFrame({
  photo,
  index = 0,
  sizes,
  priority,
  fit = "cover",
  compact = false,
  decorative = false,
  className,
}: PhotoFrameProps) {
  if (photo.src) {
    return (
      <Image
        src={photo.src}
        alt={decorative ? "" : photo.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn(fit === "cover" ? "object-cover" : "object-contain", className)}
        style={photo.position ? { objectPosition: photo.position } : undefined}
      />
    );
  }

  return (
    <div
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": photo.alt })}
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden",
        className,
      )}
      style={{ backgroundImage: PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length] }}
    >
      <span aria-hidden className="absolute -top-1/4 -right-1/4 size-3/4 rounded-full bg-white/60 blur-2xl" />
      <span aria-hidden className="absolute -bottom-1/4 -left-1/5 size-2/3 rounded-full bg-brand-300/30 blur-2xl" />
      <Heart aria-hidden className={cn("relative fill-heart/80 text-heart/80", compact ? "size-6" : "size-[16%] min-w-9 max-w-20")} />
      {compact ? null : (
        <span
          aria-hidden
          className="relative inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-bold text-brand-800 shadow-sm backdrop-blur sm:text-sm"
        >
          <Camera className="size-3.5 sm:size-4" />
          Foto do Tobias em breve
        </span>
      )}
    </div>
  );
}
