import { Camera, Heart, Play } from "lucide-react";
import Image from "next/image";
import type { Photo } from "@/content/photos";
import { cn } from "@/lib/cn";

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(150deg, #ffe9ef 0%, #f3edfb 100%)",
  "linear-gradient(160deg, #f3edfb 0%, #fff6f8 100%)",
  "linear-gradient(130deg, #fdd2de 0%, #faf7fd 100%)",
  "linear-gradient(145deg, #e7dcf6 0%, #ffe9ef 100%)",
  "linear-gradient(170deg, #fff6f8 0%, #e7dcf6 100%)",
];

interface PhotoFrameProps {
  photo: Photo;
  /** Posição na lista (varia a cor do espaço reservado). */
  index?: number;
  /** Atributo `sizes` do next/image, para entregar a imagem no tamanho certo. */
  sizes: string;
  priority?: boolean;
  fit?: "cover" | "contain";
  /** Miniaturas: mostra só o coração, sem o rótulo "Foto da May em breve". */
  compact?: boolean;
  /** Esconde só o rótulo "Foto da May em breve" (mantém o coração grande). */
  hideLabel?: boolean;
  /** Use dentro de links/botões que já têm nome acessível. */
  decorative?: boolean;
  className?: string;
}

/**
 * Preenche 100% do elemento pai (que precisa ser `relative` e ter tamanho). Mostra a foto real da
 * May ou, enquanto não houver `src`, um espaço reservado delicado (nunca uma foto de terceiros).
 */
export function PhotoFrame({
  photo,
  index = 0,
  sizes,
  priority,
  fit = "cover",
  compact = false,
  hideLabel = false,
  decorative = false,
  className,
}: PhotoFrameProps) {
  if (photo.src) {
    return (
      <>
        <Image
          src={photo.src}
          alt={decorative ? "" : photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn(fit === "cover" ? "object-cover" : "object-contain", className)}
          style={photo.position ? { objectPosition: photo.position } : undefined}
        />
        {photo.video && !hideLabel ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <span
              className={cn(
                "grid place-items-center rounded-full bg-white/90 text-petal-700 shadow-lift backdrop-blur",
                compact ? "size-8" : "size-16",
              )}
            >
              <Play
                className={cn("translate-x-px fill-current", compact ? "size-3.5" : "size-6")}
              />
            </span>
          </span>
        ) : null}
      </>
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
      <span
        aria-hidden
        className="absolute -top-1/4 -right-1/4 size-3/4 rounded-full bg-white/70 blur-2xl"
      />
      <span
        aria-hidden
        className="absolute -bottom-1/4 -left-1/5 size-2/3 rounded-full bg-petal-200/50 blur-2xl"
      />
      <Heart
        aria-hidden
        strokeWidth={1.25}
        className={cn(
          "relative fill-petal-300/70 text-petal-400",
          compact ? "size-6" : "size-[18%] max-w-20 min-w-9",
        )}
      />
      {compact || hideLabel ? null : (
        <span
          aria-hidden
          className="relative inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-bold text-petal-800 shadow-sm backdrop-blur sm:text-sm"
        >
          <Camera className="size-3.5 sm:size-4" />
          Foto da May em breve
        </span>
      )}
    </div>
  );
}
