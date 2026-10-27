export interface Photo {
  /** Arquivo dentro de /public, ex.: "/fotos/tobias-1.jpg". Sem `src` = espaço reservado. Em vídeos, é a imagem de capa. */
  src?: string;
  /** Descrição da foto (leitores de tela). */
  alt: string;
  /** Legenda opcional, exibida na ampliação. */
  caption?: string;
  /** Enquadramento ao cortar, ex.: "center top" para não cortar o rosto. */
  position?: string;
  /** Se informado, o item é um VÍDEO (arquivo MP4 em /public/video/) e `src` vira a imagem de capa dele. */
  video?: string;
}

/**
 * ✏️ FOTOS E VÍDEO DO TOBIAS
 * - Fotos: copie para `public/fotos/` e liste aqui, na ordem desejada. A 1ª FOTO é a capa do site.
 * - Vídeo: copie o MP4 para `public/video/` e use `video` + `src` (imagem de capa do vídeo).
 * O primeiro vídeo da lista também aparece na capa, no botão "Assista ao vídeo".
 */
export const photos: Photo[] = [
  {
    src: "/fotos/tobias-1.webp",
    alt: "O pequeno Tobias, bebê de 9 meses, de chupeta, com curativos no rosto e a mão enfaixada",
    position: "35% 50%",
  },
  {
    src: "/fotos/tobias-video.jpg",
    video: "/video/tobias.mp4",
    alt: "Vídeo com momentos do pequeno Tobias",
    caption: "Vídeo do Tobias",
    position: "50% 12%",
  },
];

const PLACEHOLDER_COUNT = 6;

export const galleryPhotos: Photo[] =
  photos.length > 0
    ? photos
    : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => ({
        alt: `Espaço reservado para a foto ${i + 1} do Tobias`,
      }));

export const coverPhoto: Photo = galleryPhotos.find((p) => !p.video) ??
  galleryPhotos[0] ?? { alt: "Foto do Tobias" };

/** Vídeo mostrado na capa, no botão "Assista ao vídeo". */
export const featuredVideo: Photo | undefined = galleryPhotos.find((p) => p.video);
