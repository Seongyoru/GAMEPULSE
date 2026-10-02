import { contentPath, routeFamilyForType, type ContentRouteFamily } from '@gamepulse/domain';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { ko } from '@/lib/i18n';
import { getContentBySlug, getContentPage, getSlugs } from '@/server/content';
import { adsMode } from '@/server/env';
import { contentDescription, isIndexable, pageMetadata } from '@/server/seo';
import { ContentDetail, type ContentLink } from './content-detail';

export type SlugParams = Promise<{ slug: string }>;

/** Content slugs are ASCII by construction; anything else cannot exist. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_STATIC_PAGES_PER_FAMILY = 500;

async function loadPage(slug: string) {
  if (slug.length > 140 || !SLUG_PATTERN.test(slug)) return { generatedAt: null, record: null };
  return getContentPage(slug);
}

/** Resolves a linked record to its canonical path; unpublished or missing targets get no link. */
async function linkTo(slug: string | null): Promise<ContentLink | null> {
  if (!slug) return null;
  const target = await getContentBySlug(slug);
  return target ? { href: contentPath(target), title: target.title } : null;
}

/** Most recently updated pages are prerendered; the rest render on first request (ISR). */
export async function contentStaticParams(
  family: ContentRouteFamily,
): Promise<Array<{ slug: string }>> {
  const entries = await getSlugs(family);
  return [...entries]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_STATIC_PAGES_PER_FAMILY)
    .map((entry) => ({ slug: entry.slug }));
}

export async function contentMetadata(
  family: ContentRouteFamily,
  params: SlugParams,
): Promise<Metadata> {
  const { slug } = await params;
  const { record } = await loadPage(slug);
  if (!record || routeFamilyForType(record.type) !== family) {
    return { title: ko.notFound.title, robots: { index: false, follow: false } };
  }
  return pageMetadata({
    title: record.title,
    description: contentDescription(record),
    path: contentPath(record),
    noIndex: !isIndexable(record),
    type: 'article',
  });
}

export async function ContentRoute({
  family,
  params,
}: {
  family: ContentRouteFamily;
  params: SlugParams;
}) {
  const { slug } = await params;
  const { record, generatedAt } = await loadPage(slug);
  if (!record || generatedAt === null) notFound();
  // A record has exactly one canonical family; other families redirect permanently.
  if (routeFamilyForType(record.type) !== family) permanentRedirect(contentPath(record));
  const detail = record.detail;
  const [related, compensation] = await Promise.all([
    linkTo(detail.type === 'REWARD' ? detail.relatedSlug : null),
    linkTo(detail.type === 'MAINTENANCE' ? detail.compensationSlug : null),
  ]);
  return (
    <ContentDetail
      record={record}
      family={family}
      generatedAt={generatedAt}
      adsMode={adsMode()}
      links={{ related, compensation }}
    />
  );
}
