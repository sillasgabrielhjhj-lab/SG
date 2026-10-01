import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteConfig.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteConfig.url}/privacidade`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteConfig.url}/termos`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
