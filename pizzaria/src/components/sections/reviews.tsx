import { Quote, Star } from 'lucide-react';
import { buttonStyles } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { Accent, SectionHeading } from '@/components/ui/section-heading';
import { siteConfig } from '@/config/site';
import { reviews } from '@/data/reviews';
import { cn } from '@/lib/utils';

export function Reviews() {
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="bg-cream-50 py-20 lg:py-28">
      <div className="container-page">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id="reviews-title"
            eyebrow="Reviews"
            title={
              <>
                One bite and <Accent>you’re back.</Accent>
              </>
            }
            description="What our customers say is what matters most to us."
          />
          <a
            href={siteConfig.social.googleReviews}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles({ variant: 'outline', className: 'shrink-0 self-start md:self-auto' })}
          >
            <Star className="size-4 fill-gold-400 text-gold-400" aria-hidden />
            Review us on Google
          </a>
        </div>

        <ul className="scrollbar-none -mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-3">
          {reviews.map((review, i) => (
            <Reveal
              as="li"
              key={review.id}
              delay={(i % 3) * 0.08}
              className="w-[85%] shrink-0 snap-start sm:w-[60%] md:w-auto"
            >
              <figure className="relative flex h-full flex-col rounded-[1.75rem] bg-white p-7 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/[0.05]">
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5" role="img" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, s) => (
                      <Star
                        key={s}
                        aria-hidden
                        className={cn('size-4', s < review.rating ? 'fill-gold-400 text-gold-400' : 'text-ink-300')}
                      />
                    ))}
                  </div>
                  {review.placeholder && (
                    <span className="rounded-full bg-cream-200 px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-wide text-ink-500 uppercase">
                      Sample
                    </span>
                  )}
                </div>
                <Quote aria-hidden className="mt-6 size-7 text-tomato-200" />
                <blockquote className={cn('mt-3 flex-1 leading-relaxed', review.placeholder ? 'text-ink-400 italic' : 'text-ink-700')}>
                  <p>{review.text}</p>
                </blockquote>
                <figcaption className="mt-7 flex items-center gap-3 border-t border-ink-900/[0.06] pt-5">
                  <span
                    aria-hidden
                    className="inline-flex size-10 items-center justify-center rounded-full bg-cream-200 text-sm font-bold text-ink-600"
                  >
                    {review.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>
                  <span>
                    <span className="block font-semibold text-ink-900">{review.name}</span>
                    <span className="text-sm text-ink-500">{review.source}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
