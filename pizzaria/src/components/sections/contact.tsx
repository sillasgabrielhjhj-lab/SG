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
      title: 'Address',
      lines: [address.street, `${address.neighborhood} · ${address.city}, ${address.state}`, address.zip],
      link: { href: directionsUrl, label: 'Get directions' },
    },
    {
      icon: Phone,
      title: 'Phone & WhatsApp',
      lines: [contact.phoneDisplay],
      link: { href: whatsappLink('Hi! I found you through your website.'), label: 'Message on WhatsApp' },
    },
    {
      icon: InstagramIcon,
      title: 'Instagram',
      lines: [social.instagramHandle],
      link: { href: social.instagram, label: 'Follow us' },
    },
    {
      icon: Mail,
      title: 'Email',
      lines: [contact.email],
      link: { href: `mailto:${contact.email}`, label: 'Send an email' },
    },
  ];

  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-cream-50 py-20 lg:py-28">
      <div className="container-page">
        <SectionHeading
          id="contact-title"
          eyebrow="Contact"
          title={
            <>
              Come see us, <Accent>or we’ll come to you.</Accent>
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
                <h3 className="text-display text-xl font-medium">Opening hours</h3>
                <OpenStatusBadge showDetail={false} />
              </div>
              <HoursTable />
            </div>

            <a
              href={whatsappLink("Hi! I'd like to place an order.")}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: 'whatsapp', size: 'lg', className: 'w-full' })}
            >
              <WhatsAppIcon className="size-5" /> Chat on WhatsApp
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
