import 'server-only';
import {
  DAY_MS,
  isPublicGameId,
  listPublicGames,
  onlyPublicGames,
  toPulseItem,
  typesForRouteFamily,
  type ContentRecord,
  type ContentRouteFamily,
  type PulseItem,
  type ResetRuleDefinition,
} from '@gamepulse/domain';
import { cache } from 'react';
import { dataSourceKind } from './env';
import { getReadStore } from './store';

export interface DashboardData {
  generatedAt: string;
  items: PulseItem[];
  resets: ResetRuleDefinition[];
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Items relevant to TODAY, the homepage and the calendar: anything overlapping the last 45 and
 * next 60 days, minus long-finished items — plus each game's latest patch for the snapshots.
 */
function selectDashboardItems(records: readonly ContentRecord[], nowMs: number): PulseItem[] {
  const latestPatch = new Map<string, ContentRecord>();
  for (const record of records) {
    if (record.type !== 'PATCH' || record.startAt === null || Date.parse(record.startAt) > nowMs)
      continue;
    const current = latestPatch.get(record.gameId);
    if (!current || Date.parse(record.startAt) > Date.parse(current.startAt ?? ''))
      latestPatch.set(record.gameId, record);
  }
  const keep = records.filter((record) => {
    if (latestPatch.get(record.gameId)?.id === record.id) return true;
    if (record.endAt !== null) return Date.parse(record.endAt) >= nowMs - 35 * DAY_MS;
    const at = Date.parse(record.startAt ?? record.sourcePublishedAt ?? record.publishedAt);
    return at >= nowMs - 21 * DAY_MS || record.type === 'EVENT' || record.type === 'BANNER';
  });
  return keep.map(toPulseItem);
}

export const getDashboardData = cache(async (): Promise<DashboardData> => {
  const store = await getReadStore();
  const now = Date.now();
  // Hidden (INACTIVE) games contribute nothing to shared views.
  const gameIds = listPublicGames().map((game) => game.gameId);
  const [records, resets] = await Promise.all([
    store.listContent({
      gameIds,
      window: { from: iso(now - 45 * DAY_MS), to: iso(now + 60 * DAY_MS) },
      order: 'start',
    }),
    store.listResetRules(gameIds),
  ]);
  return { generatedAt: iso(now), items: selectDashboardItems(records, now), resets };
});

export interface GameData {
  generatedAt: string;
  records: ContentRecord[];
  resets: ResetRuleDefinition[];
  lastUpdatedAt: string | null;
}

export const getGameData = cache(async (gameId: string): Promise<GameData> => {
  const store = await getReadStore();
  const now = Date.now();
  const [records, resets, lastUpdatedAt] = await Promise.all([
    store.listContent({
      gameIds: [gameId],
      window: { from: iso(now - 120 * DAY_MS), to: iso(now + 120 * DAY_MS) },
      order: 'start',
    }),
    store.listResetRules([gameId]),
    store.getLastUpdatedAt(gameId),
  ]);
  return { generatedAt: iso(now), records, resets, lastUpdatedAt };
});

export const getGamePatches = cache(
  async (gameId: string): Promise<{ generatedAt: string; records: ContentRecord[] }> => {
    const store = await getReadStore();
    const generatedAt = iso(Date.now());
    const records = await store.listContent({
      gameIds: [gameId],
      types: ['PATCH', 'UPDATE'],
      order: 'recent',
      limit: 60,
    });
    return { generatedAt, records };
  },
);

/** A published record by slug; content of hidden (INACTIVE) games resolves to null (404). */
export const getContentBySlug = cache(async (slug: string): Promise<ContentRecord | null> => {
  const store = await getReadStore();
  const record = await store.getContentBySlug(slug);
  return record && isPublicGameId(record.gameId) ? record : null;
});

/** A content page's record plus the time it was rendered (the client clock's starting point). */
export const getContentPage = cache(
  async (slug: string): Promise<{ generatedAt: string; record: ContentRecord | null }> => {
    const generatedAt = iso(Date.now());
    return { generatedAt, record: await getContentBySlug(slug) };
  },
);

/** Slugs of public games' content for a route family (generateStaticParams and the sitemap). */
export const getSlugs = cache(async (family?: ContentRouteFamily) => {
  const store = await getReadStore();
  const entries = onlyPublicGames(await store.listContentSlugs());
  if (!family) return entries;
  const types = typesForRouteFamily(family);
  return entries.filter((entry) => types.includes(entry.type));
});

export function isSampleDataMode(): boolean {
  return dataSourceKind() === 'fixtures';
}
