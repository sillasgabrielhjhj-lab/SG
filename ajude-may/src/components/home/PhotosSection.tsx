import { Gallery } from "@/components/photos/Gallery";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { galleryPhotos } from "@/content/photos";

export function PhotosSection() {
  return (
    <section
      id="fotos"
      aria-labelledby="fotos-titulo"
      className="scroll-mt-20 bg-white py-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading eyebrow="Fotos" title="Conheça a May ❤️" id="fotos-titulo">
          Toque em uma foto para ampliar e use as setas para ver as próximas.
        </SectionHeading>
        <Reveal className="mt-12">
          <Gallery photos={galleryPhotos} />
        </Reveal>
      </div>
    </section>
  );
}
