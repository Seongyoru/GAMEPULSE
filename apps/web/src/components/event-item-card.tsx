'use client';

import type { PulseItem } from '@gamepulse/domain';
import { EventCard } from '@gamepulse/ui';
import { useNow } from '@gamepulse/ui/client';
import { ko } from '@/lib/i18n';
import { formatPeriod, gameViewById, statusPresentation, typeLabel } from '@/lib/present';
import { focusMoment, MomentMeta, PulseItemCard, trackEventFor } from './pulse-item-card';

/** Event or banner card with its period always visible and a live countdown. */
export function EventItemCard({
  item,
  serverNow,
  className,
}: {
  item: PulseItem;
  serverNow: number;
  className?: string;
}) {
  const now = useNow('minute', serverNow);
  const game = gameViewById(item.gameId);
  const moment = focusMoment(item, now);
  return (
    <EventCard
      href={item.href}
      title={item.title}
      game={{ gameId: game.gameId, name: game.shortName, accent: game.accent }}
      typeLabel={typeLabel(item.type, item.gameId)}
      type={item.type}
      status={statusPresentation(item, now)}
      period={formatPeriod(item.startAt, item.endAt, item.timePrecision)}
      meta={moment ? <MomentMeta moment={moment} precision={item.timePrecision} /> : null}
      rewards={item.facts.rewardItems ?? []}
      featured={item.facts.featured ?? []}
      sample={item.isSynthetic}
      sampleLabel={ko.status.sample}
      attribution={item.sourceAttribution}
      trackEvent={trackEventFor(item)}
      className={className}
    />
  );
}

/** Picks the card that fits the content type. */
export function ContentItemCard({ item, serverNow }: { item: PulseItem; serverNow: number }) {
  return item.type === 'EVENT' || item.type === 'BANNER' ? (
    <EventItemCard item={item} serverNow={serverNow} />
  ) : (
    <PulseItemCard item={item} serverNow={serverNow} />
  );
}
