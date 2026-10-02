'use client';

import { isFeatureAvailable, requireGame, type GameSnapshot } from '@gamepulse/domain';
import { GameBadge, SourceAttributionNote, cx } from '@gamepulse/ui';
import { Countdown } from '@gamepulse/ui/client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ko } from '@/lib/i18n';
import { gameViewById, typeLabel, VIEWER_TIMEZONE } from '@/lib/present';

function Row({ label, children, href }: { label: string; children: ReactNode; href?: string }) {
  const value = <span className="font-semibold tabular-nums text-text">{children}</span>;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right">
        {href ? (
          <Link href={href} className="hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/** The "10-second" card: the few facts that matter for one game right now. */
export function GameSnapshotCard({
  snapshot,
  className,
}: {
  snapshot: GameSnapshot;
  className?: string;
}) {
  const game = requireGame(snapshot.gameId);
  const view = gameViewById(snapshot.gameId);
  const s = ko.snapshot;
  const rows: ReactNode[] = [];

  if (snapshot.maintenance) {
    rows.push(
      <Row key="maintenance" label={s.maintenance} href={snapshot.maintenance.href}>
        {snapshot.maintenance.state === 'IN_PROGRESS' && snapshot.maintenance.endAt ? (
          <span className="text-rose-600 dark:text-rose-400">
            {ko.status.maintenanceLive} ·{' '}
            <Countdown target={snapshot.maintenance.endAt} timeZone={VIEWER_TIMEZONE} />
          </span>
        ) : snapshot.maintenance.startAt ? (
          <Countdown target={snapshot.maintenance.startAt} timeZone={VIEWER_TIMEZONE} />
        ) : (
          ko.status.unknown
        )}
      </Row>,
    );
  }
  if (snapshot.latestPatch) {
    rows.push(
      <Row key="patch" label={s.latestPatch} href={snapshot.latestPatch.href}>
        {snapshot.latestPatch.version ?? snapshot.latestPatch.title}
        {snapshot.latestPatch.changeCount > 0 ? (
          <span className="ml-1 font-normal text-muted">
            {s.changes(snapshot.latestPatch.changeCount)}
          </span>
        ) : null}
      </Row>,
    );
  }
  if (snapshot.nextPatch) {
    rows.push(
      <Row key="next-patch" label={s.nextPatch} href={snapshot.nextPatch.href}>
        <Countdown target={snapshot.nextPatch.at} timeZone={VIEWER_TIMEZONE} mode="dday" />
      </Row>,
    );
  }
  if (snapshot.primaryReset) {
    rows.push(
      <Row key="reset" label={snapshot.primaryReset.name}>
        <Countdown target={snapshot.primaryReset.nextAt} timeZone={VIEWER_TIMEZONE} />
      </Row>,
    );
  }
  if (isFeatureAvailable(game, 'rewards') && snapshot.rewardsAvailable > 0) {
    rows.push(
      <Row key="rewards" label={s.rewards}>
        {s.available(snapshot.rewardsAvailable)}
      </Row>,
    );
  }
  if (snapshot.currentEvents > 0) {
    rows.push(
      <Row key="events" label={s.events}>
        {s.count(snapshot.currentEvents)}
      </Row>,
    );
  }
  if (snapshot.endingSoonEvent) {
    rows.push(
      <Row key="ending" label={s.endingSoon} href={snapshot.endingSoonEvent.href}>
        <Countdown target={snapshot.endingSoonEvent.endAt} timeZone={VIEWER_TIMEZONE} />
      </Row>,
    );
  }
  if (snapshot.currentBanner?.endAt) {
    rows.push(
      <Row
        key="banner"
        label={s.banner(typeLabel('BANNER', snapshot.gameId))}
        href={snapshot.currentBanner.href}
      >
        <Countdown target={snapshot.currentBanner.endAt} timeZone={VIEWER_TIMEZONE} mode="dday" />
      </Row>,
    );
  }

  return (
    <article
      data-mg-game={snapshot.gameId}
      data-testid={`snapshot-${snapshot.gameId}`}
      className={cx('rounded-lg border border-border bg-surface p-3', className)}
    >
      <header className="mb-1 flex items-center justify-between gap-2 border-b border-border pb-2">
        <GameBadge
          name={view.name.toUpperCase()}
          accent={view.accent}
          size="md"
          href={`/games/${view.slug}`}
        />
        <Link href={`/games/${view.slug}`} className="text-xs text-muted hover:text-text">
          →
        </Link>
      </header>
      {rows.length > 0 ? (
        <dl>{rows.slice(0, 5)}</dl>
      ) : (
        <p className="py-2 text-sm text-muted">{s.none}</p>
      )}
      <SourceAttributionNote attributions={snapshot.sourceAttributions} className="mt-1" />
    </article>
  );
}
