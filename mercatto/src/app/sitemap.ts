import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";

// Sem isso, o Next gera o sitemap uma vez no build e ele fica desatualizado
// sempre que um produto é criado/desativado sem um novo deploy.
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }),
  ]);

  return [
    { url: APP_URL, changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({
      url: `${APP_URL}/categoria/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${APP_URL}/produto/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
