import { ArrowRight, Heart, Share2 } from "lucide-react";
import Link from "next/link";
import { PhotoFrame } from "@/components/photos/PhotoFrame";
import { btn } from "@/components/ui/button";
import { Reveal } from "@/components/ui/Reveal";
import { storyPhotos } from "@/content/photos";
import { journey } from "@/content/story";

/** Seção emocional: texto da campanha combinado com fotografias reais da May. */
export function JourneySection() {
  const [first, second] = storyPhotos;

  return (
    <section
      aria-labelledby="caminhada-titulo"
      className="relative isolate overflow-hidden bg-gradient-to-br from-lilac-50 via-ivory to-petal-50 py-16 lg:py-28"
    >
      <div
        aria-hidden
        className="absolute top-1/3 -left-40 -z-10 size-[28rem] rounded-full bg-petal-100/70 blur-3xl"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative aspect-[4/5] w-[78%] overflow-hidden arch shadow-lift ring-[6px] ring-white">
            <PhotoFrame photo={first} index={1} hideLabel sizes="(min-width: 1024px) 360px, 70vw" />
          </div>
          <div className="absolute right-0 bottom-[-8%] aspect-square w-[48%] overflow-hidden rounded-[2rem] shadow-lift ring-[6px] ring-white">
            <PhotoFrame photo={second} index={3} compact sizes="(min-width: 1024px) 230px, 45vw" />
          </div>
          <p className="absolute top-8 -right-1 max-w-[11rem] rotate-3 rounded-2xl bg-white/95 p-4 text-sm leading-snug font-semibold text-ink shadow-soft sm:-right-4">
            <Heart aria-hidden className="mb-1.5 size-4 fill-heart text-heart" />
            Cada gesto de carinho faz parte dessa caminhada.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <p className="inline-flex items-center gap-3 text-xs font-bold tracking-[0.22em] text-petal-700 uppercase">
            <span aria-hidden className="h-px w-8 bg-petal-300" />
            Com carinho
          </p>
          <h2
            id="caminhada-titulo"
            className="mt-4 text-[2rem] leading-[1.12] font-semibold text-ink sm:text-4xl lg:text-[2.9rem]"
          >
            {journey.title}
          </h2>
          <div className="mt-7 space-y-4 text-lg leading-relaxed text-ink/85">
            {journey.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p className="border-l-2 border-petal-300 pl-4 font-display text-xl text-petal-800 italic">
              {journey.closing}
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/doar" className={btn({ size: "lg" })}>
              Quero contribuir
              <ArrowRight aria-hidden className="size-5" />
            </Link>
            <Link href="/#compartilhar" className={btn({ variant: "secondary", size: "lg" })}>
              <Share2 aria-hidden className="size-4" />
              Compartilhar a história
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
