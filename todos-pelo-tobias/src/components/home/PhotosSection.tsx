import { Gallery } from "@/components/photos/Gallery";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { galleryPhotos } from "@/content/photos";

export function PhotosSection() {
  return (
    <section id="fotos" aria-labelledby="fotos-titulo" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <SectionHeading eyebrow="Fotos" title="Momentos do Tobias" id="fotos-titulo">
          Toque em uma foto para ampliar e use as setas para ver as próximas.
        </SectionHeading>
        <Reveal className="mt-10">
          <Gallery photos={galleryPhotos} />
        </Reveal>
      </div>
    </section>
  );
}
