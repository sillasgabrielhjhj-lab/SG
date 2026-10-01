import Link from 'next/link';
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from '@/components/icons/social';
import { siteConfig } from '@/config/site';
import { navigation } from '@/data/content';
import { getWeekSchedule } from '@/lib/hours';
import { whatsappLink } from '@/lib/whatsapp';
import { Logo } from './logo';

export function Footer() {
  const { address, contact, social } = siteConfig;
  const year = new Date().getFullYear();
  const openDays = getWeekSchedule().filter((d) => !d.closed);

  const socials = [
    { href: social.instagram, label: 'Instagram', icon: InstagramIcon },
    { href: social.facebook, label: 'Facebook', icon: FacebookIcon },
    { href: whatsappLink(), label: 'WhatsApp', icon: WhatsAppIcon },
  ].filter((s) => s.href);

  return (
    <footer className="grain bg-ink-950 pb-28 text-cream-100/70 md:pb-0">
      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-4">
          <Logo className="h-14" />
          <p className="mt-5 max-w-xs leading-relaxed">{siteConfig.description}</p>
          <ul className="mt-6 flex gap-2">
            {socials.map(({ href, label, icon: Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex size-11 items-center justify-center rounded-full bg-cream-50/[0.06] text-cream-50 transition-colors hover:bg-tomato-500"
                >
                  <Icon className="size-[1.125rem]" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Footer" className="lg:col-span-2">
          <h2 className="text-sm font-bold tracking-[0.16em] text-cream-50 uppercase">Navigate</h2>
          <ul className="mt-5 space-y-3">
            {navigation.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-cream-50">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-3">
          <h2 className="text-sm font-bold tracking-[0.16em] text-cream-50 uppercase">Contact</h2>
          <address className="mt-5 space-y-3 not-italic">
            <p>
              {address.street}
              <br />
              {address.neighborhood} · {address.city}/{address.state}
            </p>
            <p>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="hover:text-cream-50">
                {contact.phoneDisplay}
              </a>
            </p>
            <p>
              <a href={`mailto:${contact.email}`} className="break-all hover:text-cream-50">
                {contact.email}
              </a>
            </p>
          </address>
        </div>

        <div className="lg:col-span-3">
          <h2 className="text-sm font-bold tracking-[0.16em] text-cream-50 uppercase">Hours</h2>
          <ul className="mt-5 space-y-2 text-[0.9375rem]">
            {openDays.map((d) => (
              <li key={d.day} className="flex justify-between gap-4">
                <span>{d.name}</span>
                <span className="tabular-nums text-cream-50">{d.hours}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-cream-50/[0.08]">
        <div className="container-page flex flex-col gap-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <ul className="flex gap-6">
            <li>
              <Link href="/privacy" className="hover:text-cream-50">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-cream-50">
                Terms of use
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
