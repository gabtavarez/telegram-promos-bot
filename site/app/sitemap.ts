import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { getOffers } from "@/lib/data";
import { SITE } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const offers = await getOffers();
  return [
    { url: `${SITE.url}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE.url}/ofertas`, changeFrequency: "hourly", priority: 0.9 },
    ...CATEGORIES.map((category) => ({ url: `${SITE.url}/ofertas?categoria=${category.slug}`, changeFrequency: "hourly" as const, priority: 0.7 })),
    { url: `${SITE.url}/alertas`, priority: 0.5 },
    ...offers.slice(0, 200).map((offer) => ({ url: `${SITE.url}/oferta/${offer.slug}`, lastModified: offer.publishedAt, priority: 0.6 })),
  ];
}
