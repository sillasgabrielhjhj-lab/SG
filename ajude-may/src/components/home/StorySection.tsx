import { HandHeart, Quote, Sparkles, Stethoscope } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { campaign } from "@/config/campaign";
import { story } from "@/content/story";
import type { FundraisingView } from "@/lib/fundraising";
import { CampaignCard } from "./CampaignCard";

const FACT_ICONS = { rare: Sparkles, care: Stethoscope, goal: HandHeart };

/** História da May (texto oficial) ao lado do card da vaquinha, fixo na tela no desktop. */
export function StorySection({ view, siteUrl }: { view: FundraisingView; siteUrl: string }) {
  return (
    <section
      id="historia"
      aria-labelledby="historia-titulo"
      className="scroll-mt-20 bg-white py-16 lg:py-24"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-16">
        <div>
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow="A história"
              title="Conheça a caminhada da May"
              id="historia-titulo"
            />
            <div className="mt-8 space-y-5 text-lg leading-relaxed text-ink/90 sm:text-xl sm:leading-relaxed">
              {story.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Reveal>

          <Reveal className="mt-10">
            <figure className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-petal-50 via-white to-lilac-50 p-7 ring-1 ring-petal-100 sm:p-10">
              <Quote aria-hidden className="size-9 rotate-180 fill-petal-100 text-petal-300" />
              <blockquote className="mt-3 font-display text-2xl leading-snug text-ink italic sm:text-[1.7rem]">
                “{campaign.highlight}”
              </blockquote>
              <figcaption className="relative mt-5 text-sm font-bold tracking-[0.16em] text-petal-700 uppercase">
                Ajude May nessa caminhada ❤️
              </figcaption>
            </figure>
          </Reveal>

          <Reveal className="mt-10">
            <h3 className="text-xl font-semibold text-ink">Em resumo</h3>
            <ul className="mt-5 grid gap-4 sm:grid-cols-3">
              {story.facts.map(({ icon, label, text }) => {
                const Icon = FACT_ICONS[icon];
                return (
                  <li key={label} className="rounded-3xl bg-ivory p-5 ring-1 ring-petal-100">
                    <span className="grid size-10 place-items-center rounded-2xl bg-lilac-100 text-lilac-700">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <p className="mt-4 text-xs font-bold tracking-[0.14em] text-petal-700 uppercase">
                      {label}
                    </p>
                    <p className="mt-1.5 leading-relaxed text-ink/90">{text}</p>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>

        <div className="lg:sticky lg:top-28">
          <Reveal>
            <CampaignCard view={view} siteUrl={siteUrl} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
