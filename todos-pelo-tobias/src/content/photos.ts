export interface Photo {
  /** Arquivo dentro de /public, ex.: "/fotos/tobias-1.jpg". Sem `src` = espaço reservado. */
  src?: string;
  /** Descrição da foto (leitores de tela). */
  alt: string;
  /** Legenda opcional, exibida na ampliação. */
  caption?: string;
  /** Enquadramento ao cortar, ex.: "center top" para não cortar o rosto. */
  position?: string;
}

/**
 * ✏️ FOTOS DO TOBIAS
 * 1. Copie as fotos (JPG, PNG ou WebP) para a pasta `public/fotos/`.
 * 2. Liste cada uma abaixo, na ordem desejada. A PRIMEIRA é a foto de capa (banner e card).
 * Exemplo:
 *   { src: "/fotos/tobias-1.jpg", alt: "Tobias sorrindo", caption: "Legenda opcional" },
 * Enquanto a lista estiver vazia, o site exibe espaços reservados no lugar das fotos.
 */
export const photos: Photo[] = [];

const PLACEHOLDER_COUNT = 6;

export const galleryPhotos: Photo[] =
  photos.length > 0
    ? photos
    : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => ({
        alt: `Espaço reservado para a foto ${i + 1} do Tobias`,
      }));

export const coverPhoto: Photo = galleryPhotos[0] ?? { alt: "Foto do Tobias" };
