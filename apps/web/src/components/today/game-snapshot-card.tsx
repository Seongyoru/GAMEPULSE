'use client';

import { isFeatureAvailable, requireGame, type GameSnapshot } from '@gamepulse/domain';
import { GameCover, SourceAttributionNote, cx } from '@gamepulse/ui';
import { Countdown } from '@gamepulse/ui/client';
import {
  ArrowUpRight,
  CalendarClock,
  Dices,
  Gift,
  Hourglass,
  PartyPopper,
  RotateCcw,
  ScrollText,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ko } from '@/lib/i18n';
import { gameViewById, typeLabel, VIEWER_TIMEZONE } from '@/lib/present';

function Row({
  label,
  icon: Icon,
  children,
  href,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
  href?: string;
}) {
  const value = <span className="font-semibold tabular-nums text-text">{children}</span>;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="flex shrink-0 items-center gap-1.5 text-muted">
        <Icon aria-hidden className="size-3.5 translate-y-px" />
        {label}
      </dt>
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
      <Row key="maintenance" label={s.maintenance} icon={Wrench} href={snapshot.maintenance.href}>
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
      <Row key="patch" label={s.latestPatch} icon={ScrollText} href={snapshot.latestPatch.href}>
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
      <Row key="next-patch" label={s.nextPatch} icon={CalendarClock} href={snapshot.nextPatch.href}>
        <Countdown target={snapshot.nextPatch.at} timeZone={VIEWER_TIMEZONE} mode="dday" />
      </Row>,
    );
  }
  if (snapshot.primaryReset) {
    rows.push(
      <Row key="reset" label={snapshot.primaryReset.name} icon={RotateCcw}>
        <Countdown target={snapshot.primaryReset.nextAt} timeZone={VIEWER_TIMEZONE} />
      </Row>,
    );
  }
  if (isFeatureAvailable(game, 'rewards') && snapshot.rewardsAvailable > 0) {
    rows.push(
      <Row key="rewards" label={s.rewards} icon={Gift}>
        {s.available(snapshot.rewardsAvailable)}
      </Row>,
    );
  }
  if (snapshot.currentEvents > 0) {
    rows.push(
      <Row key="events" label={s.events} icon={PartyPopper}>
        {s.count(snapshot.currentEvents)}
      </Row>,
    );
  }
  if (snapshot.endingSoonEvent) {
    rows.push(
      <Row key="ending" label={s.endingSoon} icon={Hourglass} href={snapshot.endingSoonEvent.href}>
        <Countdown target={snapshot.endingSoonEvent.endAt} timeZone={VIEWER_TIMEZONE} />
      </Row>,
    );
  }
  if (snapshot.currentBanner?.endAt) {
    rows.push(
      <Row
        key="banner"
        label={s.banner(typeLabel('BANNER', snapshot.gameId))}
        icon={Dices}
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
      className={cx(
        'overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(15_23_42/0.05)]',
        className,
      )}
    >
      <Link href={`/games/${view.slug}`} className="group block">
        <GameCover gameId={snapshot.gameId} className="h-20">
          <div className="flex h-full items-end justify-between gap-2 px-3 pb-2.5">
            <span className="min-w-0">
              <span className="font-title block truncate text-[22px] leading-none text-white [text-shadow:0_2px_8px_rgb(0_0_0/0.5)]">
                {view.name}
              </span>
              <span className="mt-1 block truncate font-display text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
                {view.englishName}
              </span>
            </span>
            <ArrowUpRight
              aria-hidden
              className="size-4 shrink-0 text-white/80 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </div>
        </GameCover>
      </Link>
      <div className="px-3 pb-2 pt-1">
        {rows.length > 0 ? (
          <dl className="divide-y divide-border/70">{rows.slice(0, 5)}</dl>
        ) : (
          <p className="py-2 text-sm text-muted">{s.none}</p>
        )}
        <SourceAttributionNote attributions={snapshot.sourceAttributions} className="mt-1" />
      </div>
    </article>
  );
}
