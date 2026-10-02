import type { MetadataRoute } from 'next';
import { isSampleDataMode } from '@/server/content';
import { absoluteUrl } from '@/server/seo';

export default function robots(): MetadataRoute.Robots {
  // Sample-data deployments (local, previews) must never be crawled.
  if (isSampleDataMode()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
