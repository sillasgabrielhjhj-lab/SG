import { ChefHat, Flame, Leaf, Timer, Wheat } from 'lucide-react';
import { Reveal } from '@/components/ui/reveal';
import { Accent, SectionHeading } from '@/components/ui/section-heading';
import { SmartImage } from '@/components/ui/smart-image';
import { about, process } from '@/data/content';

const icons = { wheat: Wheat, leaf: Leaf, flame: Flame, timer: Timer, chef: ChefHat } as const;

export function About() {
  return (
    <>
      <section id="sobre" aria-labelledby="sobre-title" className="overflow-hidden bg-cream-100 py-20 lg:py-32">
        <div className="container-page grid items-center gap-16 lg:grid-cols-12 lg:gap-10">
          <Reveal className="relative lg:col-span-6">
            <div className="relative mx-auto max-w-lg pb-[12%] lg:max-w-none">
              <SmartImage
                src={about.images[0].src}
                alt={about.images[0].alt}
                sizes="(min-width: 1024px) 32rem, 75vw"
                fallback="image"
                className="aspect-[4/5] w-[76%] rounded-[2rem] shadow-[var(--shadow-lift)]"
              />
              <SmartImage
                src={about.images[1].src}
                alt={about.images[1].alt}
                sizes="(min-width: 1024px) 22rem, 50vw"
                fallback="pizza"
                className="absolute right-0 bottom-0 aspect-square w-[52%] rounded-[1.75rem] border-[6px] border-cream-100 shadow-[var(--shadow-lift)]"
              />
              <BadgeSeal />
            </div>
          </Reveal>

          <div className="lg:col-span-6 lg:pl-6">
            <SectionHeading
              id="sobre-title"
              eyebrow={about.eyebrow}
              title={
                <>
                  {about.titleStart} <Accent>{about.titleAccent}</Accent>
                </>
              }
            />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-600 sm:text-lg">
              {about.paragraphs.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
            <ul className="mt-10 space-y-6">
              {about.pillars.map((pillar, i) => {
                const Icon = icons[pillar.icon];
                return (
                  <Reveal as="li" key={pillar.title} delay={i * 0.08} className="flex gap-4">
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-tomato-500 shadow-[var(--shadow-soft)]">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-semibold text-ink-900">{pillar.title}</h3>
                      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-500">{pillar.text}</p>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="processo-title" className="grain bg-ink-900 py-20 text-cream-50 lg:py-28">
        <div className="container-page">
          <SectionHeading
            id="processo-title"
            tone="dark"
            align="center"
            eyebrow={process.eyebrow}
            title={process.title}
          />
          <ol className="relative mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <span aria-hidden className="absolute top-8 right-[12%] left-[12%] hidden h-px bg-cream-50/10 lg:block" />
            {process.steps.map((step, i) => {
              const Icon = icons[step.icon];
              return (
                <Reveal as="li" key={step.title} delay={i * 0.1} className="relative rounded-[1.75rem] bg-cream-50/[0.04] p-7 ring-1 ring-cream-50/[0.08]">
                  <div className="flex items-center justify-between">
                    <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-ink-800 text-tomato-400 ring-1 ring-cream-50/10">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span aria-hidden className="text-display text-5xl font-light text-cream-50/15 italic">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-display mt-7 text-2xl font-medium">
                    <span className="sr-only">Passo {i + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-cream-100/65">{step.text}</p>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </section>
    </>
  );
}

/** Selo circular girando lentamente ("Feita à mão · Massa artesanal"). */
function BadgeSeal() {
  return (
    <div aria-hidden className="absolute top-[6%] right-[6%] size-28 sm:size-32">
      <svg viewBox="0 0 120 120" className="animate-spin-slow size-full text-ink-900">
        <defs>
          <path id="seal-circle" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
        </defs>
        <circle cx="60" cy="60" r="59" className="fill-cream-50" />
        <text className="fill-current text-[10.5px] font-bold tracking-[0.2em] uppercase">
          <textPath href="#seal-circle">Feita à mão • Massa artesanal • </textPath>
        </text>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-tomato-500 text-white">
          <Wheat className="size-6" />
        </span>
      </span>
    </div>
  );
}
