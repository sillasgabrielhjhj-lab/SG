import { ArrowRight, Bike, Clock, Wheat } from 'lucide-react';
import { OpenStatusBadge } from '@/components/layout/open-status';
import { buttonStyles } from '@/components/ui/button';
import { SmartImage } from '@/components/ui/smart-image';
import { siteConfig } from '@/config/site';
import { hero } from '@/data/content';
import { HeroFeaturedCard } from './hero-featured-card';

const perks = [
  { icon: Clock, title: siteConfig.delivery.estimate, text: 'avg. delivery' },
  { icon: Bike, title: 'Delivery', text: '& pickup' },
  { icon: Wheat, title: 'Artisan', text: 'dough' },
];

export function Hero() {
  return (
    <section
      id="home"
      aria-labelledby="hero-title"
      className="grain relative overflow-hidden bg-ink-950 text-cream-50"
    >
      {/* Luz quente de fundo (sutil) */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[8%] -right-[20%] size-[46rem] rounded-full bg-[radial-gradient(closest-side,rgb(227_27_44/0.24),transparent)] lg:-right-[6%]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[30%] -left-[20%] size-[40rem] rounded-full bg-[radial-gradient(closest-side,rgb(0_130_74/0.14),transparent)]"
      />

      <div className="container-page relative grid items-center gap-12 pt-[calc(var(--header-height)+2.5rem)] pb-16 sm:gap-14 lg:min-h-[min(100svh,58rem)] lg:grid-cols-12 lg:gap-6 lg:pt-[calc(var(--header-height)+3rem)] lg:pb-20">
        <div className="lg:col-span-6">
          <p className="animate-fade-up mb-6 inline-flex items-center gap-3 text-xs font-bold tracking-[0.22em] text-tomato-300 uppercase">
            <span aria-hidden className="h-px w-8 bg-current opacity-60" />
            {hero.eyebrow}
          </p>

          <h1
            id="hero-title"
            className="animate-rise text-display text-[2.85rem] leading-[0.98] font-medium sm:text-[4rem] lg:text-[4.5rem] xl:text-[5.25rem]"
          >
            {hero.titleStart}{' '}
            <em className="font-normal text-tomato-400 italic">{hero.titleAccent}</em>
          </h1>

          <p
            className="animate-fade-up mt-6 max-w-xl text-base leading-relaxed text-cream-100/72 sm:text-lg"
            style={{ animationDelay: '120ms' }}
          >
            {hero.description}
          </p>

          <div className="animate-fade-up mt-9 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '220ms' }}>
            <a href="#menu" className={buttonStyles({ size: 'lg', className: 'group' })}>
              Order now
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </a>
            <a href="#menu" className={buttonStyles({ size: 'lg', variant: 'outline-light' })}>
              See the menu
            </a>
          </div>

          <ul
            className="animate-fade-up mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-cream-50/10 pt-7"
            style={{ animationDelay: '320ms' }}
          >
            {perks.map(({ icon: Icon, title, text }) => (
              <li key={text} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-cream-50/[0.07] text-tomato-300">
                  <Icon className="size-[1.125rem]" aria-hidden />
                </span>
                <span className="text-sm leading-tight">
                  <span className="block font-semibold text-cream-50">{title}</span>
                  <span className="text-cream-100/60">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="animate-fade-up mt-8" style={{ animationDelay: '380ms' }}>
            <OpenStatusBadge tone="dark" />
          </div>
        </div>

        <div className="relative lg:col-span-6">
          <div className="relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-[30rem] lg:max-w-[38rem]">
            <div aria-hidden className="absolute inset-0 rounded-full border border-cream-50/[0.07]" />
            <div
              aria-hidden
              className="animate-spin-slow absolute inset-[3.5%] rounded-full border border-dashed border-cream-50/15"
            />
            <SmartImage
              src={hero.image}
              alt={hero.imageAlt}
              priority
              quality={75}
              sizes="(min-width: 1024px) 34rem, (min-width: 640px) 27rem, 80vw"
              fallback="pizza"
              tone="dark"
              className="absolute inset-[8%] rounded-full shadow-[0_50px_100px_-30px_rgb(0_0_0/0.85)] ring-1 ring-cream-50/10"
            />
            <div
              className="animate-float absolute top-[6%] right-0 sm:right-[2%]"
              style={{ animationDelay: '-2s' }}
            >
              <div className="rounded-2xl bg-cream-50/10 px-4 py-3 text-sm shadow-xl ring-1 ring-cream-50/15 backdrop-blur-md">
                <p className="font-semibold">Half & half</p>
                <p className="text-xs text-cream-100/70">2 flavors, 1 pizza</p>
              </div>
            </div>
            <div className="animate-float absolute bottom-[2%] -left-1 sm:bottom-[6%] sm:left-0">
              <HeroFeaturedCard />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
