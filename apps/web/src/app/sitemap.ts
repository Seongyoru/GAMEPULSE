import { contentPath, listGames } from '@gamepulse/domain';
import type { MetadataRoute } from 'next';
import { getSlugs, isSampleDataMode } from '@/server/content';
import { gameTabPath, GAME_TABS, isTabAvailable } from '@/server/games';
import { absoluteUrl } from '@/server/seo';

export const revalidate = 3600;

/** Indexable URLs only: synthetic content and sample-data deployments are excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isSampleDataMode()) return [];
  const staticEntries: MetadataRoute.Sitemap = [
    ...['/', '/today', '/games', '/calendar'].map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: 'hourly' as const,
      priority: path === '/' ? 1 : 0.8,
    })),
    ...['/sources', '/terms', '/privacy'].map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: 'monthly' as const,
      priority: 0.2,
    })),
  ];
  const gameEntries: MetadataRoute.Sitemap = listGames()
    .filter((game) => game.status !== 'INACTIVE')
    .flatMap((game) =>
      GAME_TABS.filter((tab) => isTabAvailable(game, tab)).map((tab) => ({
        url: absoluteUrl(gameTabPath(game, tab)),
        changeFrequency: 'hourly' as const,
        priority: tab === 'overview' ? 0.8 : 0.6,
      })),
    );
  const contentEntries: MetadataRoute.Sitemap = (await getSlugs())
    .filter((entry) => !entry.isSynthetic)
    .map((entry) => ({
      url: absoluteUrl(contentPath(entry)),
      lastModified: entry.updatedAt,
      changeFrequency: 'daily',
      priority: 0.5,
    }));
  return [...staticEntries, ...gameEntries, ...contentEntries];
}
