'use client';

import {
  buildGameSnapshot,
  effectiveTimeMs,
  groupByTimeline,
  type PulseItem,
  type ResetRuleDefinition,
} from '@gamepulse/domain';
import { EmptyState, SectionHeader } from '@gamepulse/ui';
import { useNow } from '@gamepulse/ui/client';
import Link from 'next/link';
import { useMemo } from 'react';
import { ko } from '@/lib/i18n';
import { formatInstant } from '@/lib/present';
import { ContentItemCard } from '../event-item-card';
import { GameSnapshotCard } from '../today/game-snapshot-card';
import { ResetList } from './reset-list';

const PATCH_TYPES = new Set<PulseItem['type']>(['PATCH', 'UPDATE']);
const UPCOMING_WINDOW_MS = 30 * 24 * 3_600_000;

export interface GameOverviewProps {
  gameId: string;
  gameSlug: string;
  items: PulseItem[];
  resets: ResetRuleDefinition[];
  generatedAt: string;
  lastUpdatedAt: string | null;
}

/** Game overview: what is live now, what comes next, latest patches and resets. */
export function GameOverview({
  gameId,
  gameSlug,
  items,
  resets,
  generatedAt,
  lastUpdatedAt,
}: GameOverviewProps) {
  const serverNow = Date.parse(generatedAt);
  const now = useNow('minute', serverNow);
  const t = ko.game;

  const snapshot = useMemo(
    () => buildGameSnapshot({ gameId, items, resets, now: new Date(now) }),
    [gameId, items, resets, now],
  );
  const groups = useMemo(
    () =>
      groupByTimeline(
        items.filter((item) => !PATCH_TYPES.has(item.type)),
        now,
        { upcomingWindowMs: UPCOMING_WINDOW_MS, recentLimit: 4 },
      ),
    [items, now],
  );
  const patches = useMemo(
    () =>
      items
        .filter((item) => PATCH_TYPES.has(item.type))
        .sort((a, b) => effectiveTimeMs(b) - effectiveTimeMs(a))
        .slice(0, 3),
    [items],
  );

  const list = (entries: PulseItem[]) => (
    <div className="grid gap-2">
      {entries.map((item) => (
        <ContentItemCard key={item.id} item={item} serverNow={serverNow} />
      ))}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-8">
        <section aria-labelledby="overview-current" data-testid="overview-current">
          <SectionHeader
            id="overview-current"
            eyebrow="NOW"
            title={t.current}
            count={groups.current.length}
          />
          {groups.current.length > 0 ? list(groups.current) : <EmptyState title={t.noItems} />}
        </section>

        {groups.upcoming.length > 0 ? (
          <section aria-labelledby="overview-upcoming">
            <SectionHeader
              id="overview-upcoming"
              eyebrow="UPCOMING"
              title={t.upcoming}
              count={groups.upcoming.length}
            />
            {list(groups.upcoming)}
          </section>
        ) : null}

        <section aria-labelledby="overview-patches">
          <SectionHeader
            id="overview-patches"
            eyebrow="PATCHES"
            title={t.latestPatches}
            action={
              <Link
                href={`/games/${gameSlug}/patches`}
                className="text-sm font-semibold text-muted hover:text-text"
              >
                {t.allPatches} →
              </Link>
            }
          />
          {patches.length > 0 ? list(patches) : <EmptyState title={t.noPatches} />}
        </section>

        {groups.recent.length > 0 ? (
          <section aria-labelledby="overview-recent">
            <SectionHeader id="overview-recent" eyebrow="RECENT" title={t.recent} />
            {list(groups.recent)}
          </section>
        ) : null}
      </div>

      <aside className="space-y-6">
        <GameSnapshotCard snapshot={snapshot} />
        {resets.length > 0 ? (
          <section aria-labelledby="overview-resets">
            <SectionHeader
              id="overview-resets"
              eyebrow="RESETS"
              title={ko.game.tabs.resets}
              action={
                <Link
                  href={`/games/${gameSlug}/resets`}
                  className="text-sm font-semibold text-muted hover:text-text"
                >
                  {t.resetsLink} →
                </Link>
              }
            />
            <ResetList resets={resets} generatedAt={generatedAt} limit={3} />
          </section>
        ) : null}
        {lastUpdatedAt ? (
          <p className="text-xs text-muted">
            {t.lastUpdated}{' '}
            <time dateTime={lastUpdatedAt} className="font-mono tabular-nums">
              {formatInstant(lastUpdatedAt)}
            </time>
          </p>
        ) : null}
      </aside>
    </div>
  );
}
