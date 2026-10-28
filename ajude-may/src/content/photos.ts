export interface Photo {
  /** Arquivo dentro de /public, ex.: "/fotos/may-1.jpg". Sem `src` = espaço reservado. */
  src?: string;
  /** Descrição da foto (leitores de tela). */
  alt: string;
  /** Legenda opcional, exibida na ampliação. */
  caption?: string;
  /** Enquadramento ao cortar, ex.: "center top" para não cortar o rosto. */
  position?: string;
  /** Se informado, o item é um VÍDEO (MP4 em /public/video/) e `src` vira a imagem de capa dele. */
  video?: string;
}

/**
 * ✏️ FOTOS DA MAY — somente fotografias reais, autorizadas pela família ou pela organização.
 * Copie os arquivos para `public/fotos/` e liste-os aqui, na ordem desejada. A 1ª FOTO é a capa
 * (banner, card da vaquinha e página de doação). Exemplo:
 *
 *   { src: "/fotos/may-1.jpg", alt: "May sorrindo no jardim", position: "center top" },
 *
 * Vídeo: copie o MP4 para `public/video/` e use `video` + `src` (imagem de capa do vídeo).
 * Enquanto a lista estiver vazia, o site mostra espaços reservados delicados (nunca fotos de terceiros).
 */
export const photos: Photo[] = [
  {
    src: "/fotos/may-1.jpg",
    alt: "Menina de vestido listrado sentada entre uma mulher e um homem, em frente a uma parede branca",
    position: "50% 30%",
  },
  {
    src: "/fotos/may-video.jpg",
    video: "/video/may.mp4",
    alt: "Vídeo da campanha Ajude May",
    caption: "Vídeo da campanha",
    position: "50% 25%",
  },
];

const PLACEHOLDER_COUNT = 5;

export const galleryPhotos: Photo[] =
  photos.length > 0
    ? photos
    : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => ({
        alt: `Espaço reservado para a foto ${i + 1} da May`,
      }));

export const coverPhoto: Photo = galleryPhotos.find((p) => !p.video) ??
  galleryPhotos[0] ?? { alt: "Foto da May" };

/** Vídeo mostrado na capa, no botão "Assista ao vídeo". */
export const featuredVideo: Photo | undefined = galleryPhotos.find((p) => p.video);

/** Fotos da seção emocional (2ª e 3ª da lista; repete a capa se houver poucas). */
export const storyPhotos: [Photo, Photo] = [
  galleryPhotos[1] ?? coverPhoto,
  galleryPhotos[2] ?? coverPhoto,
];
