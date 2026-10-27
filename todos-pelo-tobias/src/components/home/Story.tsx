import { ArrowRight, Baby, Heart, House, MapPin, Stethoscope } from "lucide-react";
import Link from "next/link";
import { btn } from "@/components/ui/button";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { story } from "@/content/story";

const FACT_ICONS = { age: Baby, health: Stethoscope, family: MapPin, home: House };

export function Story() {
  return (
    <section
      id="conheca-tobias"
      aria-labelledby="conheca-titulo"
      className="scroll-mt-20 bg-cream py-16 lg:py-24"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-16">
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="A história da campanha"
            title="Conheça o Tobias"
            id="conheca-titulo"
          />
          <div className="mt-7 space-y-5 text-lg leading-relaxed text-ink/90">
            {story.paragraphs.length > 0 ? (
              story.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
            ) : (
              <p className="rounded-2xl border border-dashed border-brand-300 bg-white/70 p-6 text-muted">
                {story.placeholder}
              </p>
            )}
          </div>
          <Link href="/doar" className={btn({ size: "lg", className: "mt-8" })}>
            Quero ajudar o Tobias
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        </Reveal>

        <div className="space-y-4">
          {story.facts.length > 0 ? (
            <Reveal>
              <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-brand-100 sm:p-7">
                <h3 className="text-xl font-extrabold text-brand-950">Em resumo</h3>
                <ul className="mt-5 space-y-5">
                  {story.facts.map(({ icon, label, text }) => {
                    const Icon = FACT_ICONS[icon];
                    return (
                      <li key={label} className="flex gap-3.5">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                          <Icon aria-hidden className="size-5" />
                        </span>
                        <div>
                          <p className="text-sm font-bold tracking-wide text-brand-700 uppercase">
                            {label}
                          </p>
                          <p className="mt-0.5 leading-relaxed text-ink/90">{text}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>
          ) : null}
          {story.highlights.map((text, i) => (
            <Reveal key={text} delay={(i + 1) * 130}>
              <blockquote className="flex items-start gap-4 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-brand-100">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blush text-heart">
                  <Heart aria-hidden className="size-5 fill-current" />
                </span>
                <p className="font-display text-xl leading-snug font-bold text-brand-900 sm:text-2xl">
                  {text}
                </p>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
