import 'server-only';
import {
  contentPath,
  gameDisplayName,
  PRODUCT_NAME,
  requireGame,
  type ContentRecord,
  type GameConfig,
} from '@gamepulse/domain';
import type { Metadata } from 'next';
import { ko } from '@/lib/i18n';
import { typeLabel } from '@/lib/present';
import { siteUrl } from './env';

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  /** Synthetic or thin pages must not be indexed. */
  noIndex?: boolean;
  type?: 'website' | 'article';
  /** Use the title as-is instead of the "%s | GAMEPULSE" template. */
  absoluteTitle?: boolean;
}

/** Default social card (app/opengraph-image.tsx); pages that set openGraph must repeat it. */
const DEFAULT_SOCIAL_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: `${PRODUCT_NAME} — All Your Games. One Pulse.`,
};

export function pageMetadata({
  title,
  description,
  path,
  noIndex,
  type = 'website',
  absoluteTitle = false,
}: PageMetaInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${PRODUCT_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: PRODUCT_NAME,
      locale: 'ko_KR',
      type,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Content pages are indexable only when real (not synthetic) and structured enough to be useful. */
export function isIndexable(record: ContentRecord): boolean {
  if (record.isSynthetic) return false;
  if (record.type === 'ANNOUNCEMENT' && !record.summary) return false;
  return true;
}

export function contentDescription(record: ContentRecord): string {
  const game = gameDisplayName(requireGame(record.gameId), 'ko-KR');
  const base = record.summary ?? `${game} ${typeLabel(record.type, record.gameId)} 정보`;
  return `${game} · ${base}`.slice(0, 160);
}

// ── JSON-LD ────────────────────────────────────────────────────────────────

export type JsonLd = Record<string, unknown>;

export function breadcrumbJsonLd(items: ReadonlyArray<{ name: string; path: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: PRODUCT_NAME,
    alternateName: ko.site.tagline,
    url: absoluteUrl('/'),
    inLanguage: 'ko-KR',
    description: ko.site.description,
  };
}

export function gameJsonLd(game: GameConfig): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: gameDisplayName(game, 'ko-KR'),
    alternateName: game.name,
    publisher: { '@type': 'Organization', name: game.publisher },
    url: game.officialUrl,
  };
}

/** Structured data for a content record (Event for time-bounded items, Article otherwise). */
export function contentJsonLd(record: ContentRecord): JsonLd {
  const game = requireGame(record.gameId);
  const url = absoluteUrl(contentPath(record));
  const ranged =
    record.type === 'EVENT' || record.type === 'BANNER' || record.type === 'MAINTENANCE';
  if (ranged && record.startAt) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: record.title,
      description: record.summary ?? undefined,
      startDate: record.startAt,
      endDate: record.endAt ?? undefined,
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'VirtualLocation', url: record.source.url },
      organizer: { '@type': 'Organization', name: game.publisher, url: game.officialUrl },
      url,
      inLanguage: record.sourceLocale,
    };
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: record.title,
    description: record.summary ?? undefined,
    datePublished: record.sourcePublishedAt ?? record.publishedAt,
    dateModified: record.updatedAt,
    about: { '@type': 'VideoGame', name: gameDisplayName(game, 'ko-KR') },
    isBasedOn: record.source.url,
    publisher: { '@type': 'Organization', name: PRODUCT_NAME },
    url,
    inLanguage: record.sourceLocale,
  };
}

const LT_ESCAPE = `${String.fromCharCode(92)}u003c`;

/** Serializes JSON-LD for an inline script; "<" is escaped so source text cannot close the tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replaceAll('<', LT_ESCAPE);
}
