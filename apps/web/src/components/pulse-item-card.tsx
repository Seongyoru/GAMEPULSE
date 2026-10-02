'use client';

import {
  computeMaintenanceState,
  computeStatusForType,
  toEpochMs,
  type PulseItem,
} from '@gamepulse/domain';
import { PulseCard, StatusChip } from '@gamepulse/ui';
import { Countdown, useNow } from '@gamepulse/ui/client';
import type { ReactNode } from 'react';
import { ko } from '@/lib/i18n';
import {
  formatInstant,
  gameViewById,
  statusPresentation,
  typeLabel,
  VIEWER_TIMEZONE,
} from '@/lib/present';

export function trackEventFor(item: PulseItem): string {
  if (item.type === 'PATCH' || item.type === 'UPDATE') return 'patch_opened';
  if (item.type === 'REWARD' || item.type === 'REDEEM_CODE') return 'reward_opened';
  return 'pulse_opened';
}

/** The moment that matters for this item right now, with a label. */
export function focusMoment(item: PulseItem, nowMs: number): { label: string; at: string } | null {
  const t = ko.time;
  const start = toEpochMs(item.startAt);
  if (item.type === 'MAINTENANCE') {
    const state = computeMaintenanceState(item, nowMs);
    if (state === 'IN_PROGRESS' && item.endAt) return { label: t.endsIn, at: item.endAt };
    if (state === 'SCHEDULED' && item.startAt) return { label: t.startsIn, at: item.startAt };
    return null;
  }
  if (start !== null && start > nowMs && item.startAt)
    return { label: t.startsIn, at: item.startAt };
  const status = computeStatusForType(item.type, item, nowMs);
  if ((status === 'LIVE' || status === 'ENDING_SOON') && item.endAt) {
    return {
      label: item.type === 'REWARD' || item.type === 'REDEEM_CODE' ? t.claimBy : t.endsIn,
      at: item.endAt,
    };
  }
  return null;
}

/** "종료까지 / 02:13:45" — the label and live countdown of an item's focus moment. */
export function MomentMeta({
  moment,
  precision,
}: {
  moment: { label: string; at: string };
  precision: PulseItem['timePrecision'];
}) {
  return (
    <div className="leading-tight">
      <p className="text-[11px] text-muted">{moment.label}</p>
      <Countdown
        target={moment.at}
        timeZone={VIEWER_TIMEZONE}
        precision={precision}
        className="text-sm font-bold text-text"
      />
    </div>
  );
}

export interface PulseItemCardProps {
  item: PulseItem;
  /** Page generation time (epoch ms) used for SSR/hydration. */
  serverNow: number;
  actions?: ReactNode;
  className?: string;
}

export function PulseItemCard({ item, serverNow, actions, className }: PulseItemCardProps) {
  const now = useNow('minute', serverNow);
  const game = gameViewById(item.gameId);
  const status = statusPresentation(item, now);
  const moment = focusMoment(item, now);

  let meta: ReactNode = null;
  if (moment) {
    meta = <MomentMeta moment={moment} precision={item.timePrecision} />;
  } else if (
    item.type === 'PATCH' ||
    item.type === 'UPDATE' ||
    item.type === 'ANNOUNCEMENT' ||
    (item.startAt === null && item.endAt === null)
  ) {
    const at = item.startAt ?? item.sourcePublishedAt ?? item.publishedAt;
    meta = (
      <p className="font-mono text-xs tabular-nums text-muted">
        {formatInstant(at, item.timePrecision)}
      </p>
    );
  }

  const facts = item.facts;
  const summary =
    facts.changeHighlights && facts.changeHighlights.length > 0
      ? facts.changeHighlights.join(' · ')
      : facts.featured && facts.featured.length > 0
        ? facts.featured.join(' · ')
        : item.summary;

  return (
    <PulseCard
      href={item.href}
      title={item.title}
      game={{ gameId: game.gameId, name: game.shortName, accent: game.accent }}
      typeLabel={typeLabel(item.type, item.gameId)}
      type={item.type}
      status={status}
      meta={meta}
      summary={summary}
      rewards={facts.rewardItems ?? []}
      sample={item.isSynthetic}
      sampleLabel={ko.status.sample}
      attribution={item.sourceAttribution}
      trackEvent={trackEventFor(item)}
      actions={actions}
      className={className}
    />
  );
}

/** Client-side live status chip for server-rendered pages. */
export function LiveStatusChip({
  item,
  serverNow,
}: {
  item: Pick<PulseItem, 'type' | 'startAt' | 'endAt' | 'sourcePublishedAt' | 'publishedAt'>;
  serverNow: number;
}) {
  const now = useNow('minute', serverNow);
  const status = statusPresentation(item, now);
  return status ? <StatusChip tone={status.tone}>{status.label}</StatusChip> : null;
}
