import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = getSiteUrl();
  return [
    { url, changeFrequency: "weekly", priority: 1 },
    { url: `${url}/doar`, changeFrequency: "monthly", priority: 0.9 },
  ];
}
