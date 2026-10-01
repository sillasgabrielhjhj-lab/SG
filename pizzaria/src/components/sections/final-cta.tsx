import { ArrowRight } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/social';
import { buttonStyles } from '@/components/ui/button';
import { SmartImage } from '@/components/ui/smart-image';
import { finalCta } from '@/data/content';
import { whatsappLink } from '@/lib/whatsapp';

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="bg-cream-50 pb-20 lg:pb-28">
      <div className="container-page">
        <div className="grain relative grid overflow-hidden rounded-[2rem] bg-tomato-600 text-cream-50 md:grid-cols-2 lg:rounded-[2.5rem]">
          <div className="relative z-10 p-8 sm:p-12 lg:p-16">
            <h2 id="cta-title" className="text-display text-5xl leading-none font-medium sm:text-6xl lg:text-7xl">
              {finalCta.title}
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-cream-50/85">{finalCta.text}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#cardapio" className={buttonStyles({ variant: 'light', size: 'lg', className: 'group' })}>
                Montar meu pedido
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </a>
              <a
                href={whatsappLink('Olá! Gostaria de fazer um pedido.')}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles({ variant: 'outline-light', size: 'lg' })}
              >
                <WhatsAppIcon className="size-5" /> WhatsApp
              </a>
            </div>
          </div>
          <div className="relative min-h-64 md:min-h-full">
            <SmartImage
              src={finalCta.image}
              alt={finalCta.imageAlt}
              sizes="(min-width: 768px) 40rem, 100vw"
              fallback="pizza"
              tone="tomato"
              className="absolute inset-0"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-tomato-600 via-tomato-600/20 to-transparent max-md:bg-gradient-to-b" />
          </div>
        </div>
      </div>
    </section>
  );
}
