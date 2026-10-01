import { siteConfig } from '@/config/site';
import { categories } from '@/data/categories';
import { products } from '@/data/menu';
import { hero } from '@/data/content';
import { getSchemaOpeningHours } from './hours';
import { getStartingPrice } from './menu';

/** Dados estruturados (schema.org) para o Google entender a pizzaria e o cardápio. */
export function restaurantJsonLd() {
  const { address, contact, social } = siteConfig;
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${siteConfig.url}/#restaurant`,
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    image: [`${hero.image}?w=1200&q=75&auto=format`],
    logo: `${siteConfig.url}/brand/logo.png`,
    telephone: `+${contact.whatsapp}`,
    email: contact.email,
    priceRange: siteConfig.priceRange,
    servesCuisine: ['Pizza', 'Italian'],
    acceptsReservations: false,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.street,
      addressLocality: address.city,
      addressRegion: address.state,
      postalCode: address.zip,
      addressCountry: address.country,
    },
    ...(address.geo ? { geo: { '@type': 'GeoCoordinates', ...address.geo } } : {}),
    sameAs: [social.instagram, social.facebook].filter(Boolean),
    openingHoursSpecification: getSchemaOpeningHours(),
    hasMenu: {
      '@type': 'Menu',
      name: 'Menu',
      url: `${siteConfig.url}/#menu`,
      hasMenuSection: categories.map((category) => ({
        '@type': 'MenuSection',
        name: category.name,
        description: category.description,
        hasMenuItem: products
          .filter((p) => p.category === category.id)
          .map((p) => ({
            '@type': 'MenuItem',
            name: p.name,
            description: p.description,
            offers: {
              '@type': 'Offer',
              price: getStartingPrice(p).toFixed(2),
              priceCurrency: 'BRL',
            },
          })),
      })),
    },
  };
}

export function jsonLdScript(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
