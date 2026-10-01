import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { InstagramIcon, WhatsAppIcon } from '@/components/icons/social';
import { OpenStatusBadge } from '@/components/layout/open-status';
import { buttonStyles } from '@/components/ui/button';
import { Accent, SectionHeading } from '@/components/ui/section-heading';
import { siteConfig } from '@/config/site';
import { whatsappLink } from '@/lib/whatsapp';
import { HoursTable } from './hours-table';
import { MapEmbed } from './map-embed';

export function Contact() {
  const { address, contact, social } = siteConfig;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.mapsQuery)}`;

  const items = [
    {
      icon: MapPin,
      title: 'Endereço',
      lines: [address.street, `${address.neighborhood} · ${address.city}/${address.state}`, `CEP ${address.zip}`],
      link: { href: directionsUrl, label: 'Como chegar' },
    },
    {
      icon: Phone,
      title: 'Telefone e WhatsApp',
      lines: [contact.phoneDisplay],
      link: { href: whatsappLink('Olá! Vim pelo site.'), label: 'Chamar no WhatsApp' },
    },
    {
      icon: InstagramIcon,
      title: 'Instagram',
      lines: [social.instagramHandle],
      link: { href: social.instagram, label: 'Seguir' },
    },
    {
      icon: Mail,
      title: 'E-mail',
      lines: [contact.email],
      link: { href: `mailto:${contact.email}`, label: 'Enviar e-mail' },
    },
  ];

  return (
    <section id="contato" aria-labelledby="contato-title" className="bg-cream-50 py-20 lg:py-28">
      <div className="container-page">
        <SectionHeading
          id="contato-title"
          eyebrow="Contato"
          title={
            <>
              Venha até nós, <Accent>ou a gente vai até você.</Accent>
            </>
          }
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map(({ icon: Icon, title, lines, link }) => (
                <li key={title} className="flex flex-col rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/[0.05]">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-tomato-50 text-tomato-600">
                    <Icon className="size-[1.125rem]" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-ink-500">{title}</h3>
                  <address className="mt-1 not-italic text-ink-900">
                    {lines.map((line) => (
                      <span key={line} className="block break-words">
                        {line}
                      </span>
                    ))}
                  </address>
                  <a
                    href={link.href}
                    target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-tomato-600 hover:underline"
                  >
                    {link.label}
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>

            <div className="rounded-[1.5rem] bg-white p-6 shadow-[var(--shadow-soft)] ring-1 ring-ink-900/[0.05]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-display text-xl font-medium">Horários</h3>
                <OpenStatusBadge showDetail={false} />
              </div>
              <HoursTable />
            </div>

            <a
              href={whatsappLink('Olá! Gostaria de fazer um pedido.')}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: 'whatsapp', size: 'lg', className: 'w-full' })}
            >
              <WhatsAppIcon className="size-5" /> Falar no WhatsApp
            </a>
          </div>

          <div className="lg:col-span-7">
            <MapEmbed directionsUrl={directionsUrl} />
          </div>
        </div>
      </div>
    </section>
  );
}
