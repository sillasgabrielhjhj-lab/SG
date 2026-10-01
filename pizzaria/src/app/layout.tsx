import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import { siteConfig } from '@/config/site';
import { hero } from '@/data/content';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  style: ['normal', 'italic'],
  axes: ['SOFT', 'opsz'],
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const title = `${siteConfig.name} · ${siteConfig.tagline} com delivery`;

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: title, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  applicationName: siteConfig.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: siteConfig.name,
    title,
    description: siteConfig.description,
    images: [{ url: `${hero.image}?w=1200&h=630&fit=crop&q=75&auto=format`, width: 1200, height: 630, alt: hero.imageAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: siteConfig.description,
    images: [`${hero.image}?w=1200&h=630&fit=crop&q=75&auto=format`],
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#110e0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${manrope.variable}`}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" />
      </head>
      <body>
        <AppProviders>
          <div id="app-shell">
            <a
              href="#cardapio"
              className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-cream-50 transition-transform focus:translate-y-0"
            >
              Pular para o cardápio
            </a>
            {children}
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
