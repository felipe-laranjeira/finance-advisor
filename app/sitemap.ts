import type { MetadataRoute } from 'next';
import { getActiveStockSymbols } from '@/lib/market/public-data';
import { getPublicSiteUrl } from '@/lib/market/site-url';

export const revalidate = 10800;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicSiteUrl();
  const symbols = await getActiveStockSymbols();

  return [
    {
      url: new URL('/', siteUrl).toString(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...symbols.map((ticker) => ({
      url: new URL(`/acoes/${ticker}`, siteUrl).toString(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];
}
