'use client';

import { AnimatePresence, m } from 'framer-motion';
import { ArrowRight, Menu, ShoppingBag, X } from 'lucide-react';
import { InstagramIcon, WhatsAppIcon } from '@/components/icons/social';
import { buttonStyles } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { siteConfig } from '@/config/site';
import { navigation } from '@/data/content';
import { useActiveSection } from '@/hooks/use-active-section';
import { useCartSummary } from '@/hooks/use-cart-summary';
import { useScrolled } from '@/hooks/use-scrolled';
import { cn } from '@/lib/utils';
import { whatsappLink } from '@/lib/whatsapp';
import { useUI } from '@/store/ui';
import { Logo } from './logo';
import { OpenStatusBadge } from './open-status';

const sectionIds = navigation.map((n) => n.href.slice(1));

export function Header() {
  const scrolled = useScrolled(24);
  const active = useActiveSection(sectionIds);
  const mobileNavOpen = useUI((s) => s.mobileNavOpen);
  const setMobileNav = useUI((s) => s.setMobileNav);
  const solid = scrolled;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,color] duration-300',
        solid
          ? 'bg-cream-50/90 text-ink-900 shadow-[0_1px_0_rgb(26_22_19/0.06),0_10px_30px_-20px_rgb(26_22_19/0.35)] backdrop-blur-xl'
          : 'bg-transparent text-cream-50',
      )}
    >
      <div className="container-page flex h-[var(--header-height)] items-center gap-4">
        <a
          href="#home"
          className="-ml-1 shrink-0 rounded-lg p-1 transition-transform duration-300 hover:scale-[1.03]"
          aria-label={`${siteConfig.name} — back to top`}
        >
          <Logo priority className="h-10 lg:h-12" />
        </a>

        <nav aria-label="Main" className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = active === item.href.slice(1);
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'group relative rounded-full px-3.5 py-2 text-[0.9375rem] font-medium transition-colors',
                      solid ? 'text-ink-600 hover:text-ink-900' : 'text-cream-50/75 hover:text-cream-50',
                      isActive && (solid ? 'text-ink-900' : 'text-cream-50'),
                    )}
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-x-3.5 -bottom-0.5 h-0.5 origin-left rounded-full bg-tomato-500 transition-transform duration-300 ease-out',
                        isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                      )}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <OpenStatusBadge tone={solid ? 'light' : 'dark'} className="max-xl:hidden" />
          <CartButton solid={solid} />
          <a href="#menu" className={buttonStyles({ size: 'md', className: 'max-md:hidden' })}>
            Order now
          </a>
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav"
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-full transition-colors lg:hidden',
              solid ? 'hover:bg-ink-900/[0.06]' : 'hover:bg-cream-50/10',
            )}
          >
            <Menu className="size-6" aria-hidden />
          </button>
        </div>
      </div>

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNav(false)} />
    </header>
  );
}

function CartButton({ solid }: { solid: boolean }) {
  const openCart = useUI((s) => s.openCart);
  const { totals } = useCartSummary();
  const count = totals.itemCount;

  return (
    <button
      type="button"
      onClick={() => openCart()}
      aria-label={count ? `Open cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Open cart (empty)'}
      className={cn(
        'relative inline-flex size-11 items-center justify-center rounded-full transition-colors',
        solid ? 'bg-white text-ink-900 shadow-[var(--shadow-ring)] hover:bg-cream-100' : 'bg-cream-50/10 text-cream-50 hover:bg-cream-50/20',
      )}
    >
      <ShoppingBag className="size-5" aria-hidden />
      <AnimatePresence>
        {count > 0 && (
          <m.span
            key={count}
            aria-hidden
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-tomato-500 px-1 text-[0.6875rem] font-bold text-white ring-2 ring-cream-50"
          >
            {count > 99 ? '99+' : count}
          </m.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} variant="drawer" label="Menu" className="bg-ink-950 text-cream-50">
      <div id="mobile-nav" className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4">
          <Logo className="h-10" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            data-autofocus
            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-cream-50/10"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>

        <nav aria-label="Mobile menu" className="flex-1 overflow-y-auto px-6 pt-6">
          <ul className="space-y-1">
            {navigation.map((item, i) => (
              <m.li
                key={item.href}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <a
                  href={item.href}
                  onClick={onClose}
                  className="group flex items-center justify-between border-b border-cream-50/10 py-4 text-display text-3xl"
                >
                  {item.label}
                  <ArrowRight
                    className="size-5 text-cream-50/40 transition-transform group-hover:translate-x-1 group-hover:text-tomato-400"
                    aria-hidden
                  />
                </a>
              </m.li>
            ))}
          </ul>
          <OpenStatusBadge tone="dark" className="mt-8" />
        </nav>

        <div className="space-y-3 px-6 pt-4 pb-safe">
          <a href="#menu" onClick={onClose} className={buttonStyles({ size: 'lg', className: 'w-full' })}>
            Order now
          </a>
          <div className="flex gap-3">
            <a
              href={whatsappLink("Hi! I'd like to place an order.")}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: 'outline-light', className: 'flex-1' })}
            >
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
            <a
              href={siteConfig.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: 'outline-light', className: 'flex-1' })}
            >
              <InstagramIcon className="size-4" /> Instagram
            </a>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
