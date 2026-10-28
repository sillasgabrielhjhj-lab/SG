export interface Photo {
  /** Arquivo dentro de /public, ex.: "/fotos/may-1.jpg". Sem `src` = espaço reservado. */
  src?: string;
  /** Descrição da foto (leitores de tela). */
  alt: string;
  /** Legenda opcional, exibida na ampliação. */
  caption?: string;
  /** Enquadramento ao cortar, ex.: "center top" para não cortar o rosto. */
  position?: string;
}

/**
 * ✏️ FOTOS DA MAY — somente fotografias reais, autorizadas pela família ou pela organização.
 * Copie os arquivos para `public/fotos/` e liste-os aqui, na ordem desejada. A 1ª FOTO é a capa
 * (banner, card da vaquinha e página de doação). Exemplo:
 *
 *   { src: "/fotos/may-1.jpg", alt: "May sorrindo no jardim", position: "center top" },
 *
 * Enquanto a lista estiver vazia, o site mostra espaços reservados delicados (nunca fotos de terceiros).
 */
export const photos: Photo[] = [];

const PLACEHOLDER_COUNT = 5;

export const galleryPhotos: Photo[] =
  photos.length > 0
    ? photos
    : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => ({
        alt: `Espaço reservado para a foto ${i + 1} da May`,
      }));

export const coverPhoto: Photo = galleryPhotos[0] ?? { alt: "Foto da May" };

/** Fotos da seção emocional (2ª e 3ª da lista; repete a capa se houver poucas). */
export const storyPhotos: [Photo, Photo] = [
  galleryPhotos[1] ?? coverPhoto,
  galleryPhotos[2] ?? galleryPhotos[1] ?? coverPhoto,
];
