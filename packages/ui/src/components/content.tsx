/**
 * Content components: patch changes, pulse/event cards, source attribution, timeline, resets.
 * Server-compatible; live parts are delegated to <Countdown/>.
 */
import type { GameAccent, PatchChangeRecord, PatchChangeType, RewardItem } from '@gamepulse/domain';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { ACCENT_CLASSES, CHANGE_TYPE_CLASSES, type Tone } from '../tokens';
import { Countdown } from './countdown';
import { GameBadge, RewardBadge, StatusChip } from './primitives';

export interface PatchChangeProps {
  change: PatchChangeRecord;
  typeLabels: Readonly<Record<PatchChangeType, string>>;
  className?: string;
}

/** One structured patch change: target · type · field · before → after. */
export function PatchChange({ change, typeLabels, className }: PatchChangeProps) {
  const hasValues = change.beforeValue !== null || change.afterValue !== null;
  const unit = change.unit ? ` ${change.unit}` : '';
  return (
    <div
      className={cx(
        'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 py-2',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-text">{change.targetName}</span>
          <span
            className={cx(
              'rounded px-1.5 py-0.5 text-[11px] font-bold uppercase',
              CHANGE_TYPE_CLASSES[change.changeType],
            )}
          >
            {typeLabels[change.changeType]}
          </span>
        </div>
        {change.field ? <p className="text-sm text-muted">{change.field}</p> : null}
        {change.description ? (
          <p className="mt-0.5 text-sm text-text/80">{change.description}</p>
        ) : null}
      </div>
      {hasValues ? (
        <p
          className="whitespace-nowrap text-right font-mono text-sm tabular-nums"
          aria-label={`${change.beforeValue ?? '-'}에서 ${change.afterValue ?? '-'}로`}
        >
          <span className="text-muted line-through decoration-1">{change.beforeValue ?? '–'}</span>
          <span className="mx-1.5 text-muted">→</span>
          <span className="font-bold text-text">
            {change.afterValue ?? '–'}
            {unit}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export interface PulseCardProps {
  href: string;
  title: string;
  game: { name: string; accent: GameAccent; gameId: string };
  typeLabel: string;
  status?: { tone: Tone; label: string } | null;
  /** Primary time line, e.g. "종료까지" + countdown. */
  meta?: ReactNode;
  summary?: string | null;
  rewards?: readonly RewardItem[];
  sample?: boolean;
  sampleLabel?: string;
  /** Analytics event name emitted (via delegated listener) when the card is opened. */
  trackEvent?: string;
  /** Extra controls rendered above the link overlay (e.g. a "claimed" button). */
  actions?: ReactNode;
  className?: string;
}

/** Compact card for any pulse item. Carries data-mg-game so MY GAMES CSS can hide it pre-hydration. */
export function PulseCard({
  href,
  title,
  game,
  typeLabel,
  status,
  meta,
  summary,
  rewards,
  sample,
  sampleLabel = '샘플',
  trackEvent,
  actions,
  className,
}: PulseCardProps) {
  return (
    <article
      data-mg-game={game.gameId}
      className={cx(
        'group relative flex gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-zinc-400/60',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx('w-1 shrink-0 rounded-full', ACCENT_CLASSES[game.accent].bar)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <GameBadge name={game.name} accent={game.accent} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {typeLabel}
          </span>
          {status ? <StatusChip tone={status.tone}>{status.label}</StatusChip> : null}
          {sample ? <StatusChip tone="sample">{sampleLabel}</StatusChip> : null}
        </div>
        <h3 className="mt-1 font-semibold leading-snug text-text">
          <Link
            href={href}
            data-track-event={trackEvent}
            data-track-id={href}
            className="after:absolute after:inset-0 focus:outline-none focus-visible:underline"
          >
            {title}
          </Link>
        </h3>
        {summary ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{summary}</p> : null}
        {rewards && rewards.length > 0 ? <RewardBadge items={rewards} className="mt-1" /> : null}
      </div>
      {meta || actions ? (
        <div className="flex shrink-0 flex-col items-end justify-center gap-1 text-right text-sm">
          {meta}
          {actions ? <div className="relative z-10">{actions}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

export interface EventCardProps {
  href: string;
  title: string;
  game: { gameId: string; name: string; accent: GameAccent };
  typeLabel: string;
  status: { tone: Tone; label: string } | null;
  /** Pre-formatted period in the viewer zone, e.g. "10.01 (목) 10:00 – 10.21 (수) 03:59". */
  period: string | null;
  /** Live part (countdown) rendered by the app. */
  meta?: ReactNode;
  rewards?: readonly RewardItem[];
  /** Featured units of a banner (gacha) — names only. */
  featured?: readonly string[];
  sample?: boolean;
  sampleLabel?: string;
  trackEvent?: string;
  className?: string;
}

/** Card for time-bounded content (events, banners): the period is always visible. */
export function EventCard({
  href,
  title,
  game,
  typeLabel,
  status,
  period,
  meta,
  rewards,
  featured,
  sample,
  sampleLabel = '샘플',
  trackEvent,
  className,
}: EventCardProps) {
  return (
    <article
      data-mg-game={game.gameId}
      data-testid="event-card"
      className={cx(
        'group relative flex gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-zinc-400/60',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx('w-1 shrink-0 rounded-full', ACCENT_CLASSES[game.accent].bar)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <GameBadge name={game.name} accent={game.accent} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {typeLabel}
          </span>
          {status ? <StatusChip tone={status.tone}>{status.label}</StatusChip> : null}
          {sample ? <StatusChip tone="sample">{sampleLabel}</StatusChip> : null}
        </div>
        <h3 className="mt-1 font-semibold leading-snug text-text">
          <Link
            href={href}
            data-track-event={trackEvent}
            data-track-id={href}
            className="after:absolute after:inset-0 focus:outline-none focus-visible:underline"
          >
            {title}
          </Link>
        </h3>
        {period ? (
          <p className="mt-0.5 font-mono text-xs tabular-nums text-muted">{period}</p>
        ) : null}
        {featured && featured.length > 0 ? (
          <p className="mt-0.5 truncate text-sm text-text">{featured.join(' · ')}</p>
        ) : null}
        {rewards && rewards.length > 0 ? <RewardBadge items={rewards} className="mt-1" /> : null}
      </div>
      {meta ? (
        <div className="flex shrink-0 flex-col items-end justify-center text-right text-sm">
          {meta}
        </div>
      ) : null}
    </article>
  );
}

export interface SourceBadgeProps {
  sourceName: string;
  url: string;
  isOfficial: boolean;
  sourceTypeLabel: string;
  linkLabel?: string;
  sample?: boolean;
  className?: string;
}

/** Provenance: every item links back to where it came from. */
export function SourceBadge({
  sourceName,
  url,
  isOfficial,
  sourceTypeLabel,
  linkLabel = '원문 보기',
  sample,
  className,
}: SourceBadgeProps) {
  return (
    <div className={cx('flex flex-wrap items-center gap-2 text-sm', className)}>
      <StatusChip tone={sample ? 'sample' : isOfficial ? 'live' : 'neutral'}>
        {sourceTypeLabel}
      </StatusChip>
      <span className="font-medium text-text">{sourceName}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        data-source-link
        className="inline-flex items-center gap-1 text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
      >
        {linkLabel}
        <span aria-hidden>↗</span>
      </a>
    </div>
  );
}

export interface ResetTimerProps {
  name: string;
  nextAt: string;
  description: string;
  zoneLabel: string;
  timeZone: string;
  game?: { name: string; accent: GameAccent; gameId: string };
  badge?: ReactNode;
  className?: string;
}

/** Reset row: name, live countdown to the next occurrence, schedule description. */
export function ResetTimer({
  name,
  nextAt,
  description,
  zoneLabel,
  timeZone,
  game,
  badge,
  className,
}: ResetTimerProps) {
  return (
    <div
      data-mg-game={game?.gameId}
      className={cx(
        'flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {game ? <GameBadge name={game.name} accent={game.accent} /> : null}
          <span className="font-semibold text-text">{name}</span>
          {badge}
        </div>
        <p className="text-xs text-muted">
          {description} ({zoneLabel})
        </p>
      </div>
      <Countdown target={nextAt} timeZone={timeZone} className="text-base font-bold text-text" />
    </div>
  );
}

export interface TimelineEntry {
  id: string;
  time: ReactNode;
  content: ReactNode;
  gameId?: string;
  accent?: GameAccent;
  muted?: boolean;
}

export function Timeline({
  entries,
  className,
}: {
  entries: readonly TimelineEntry[];
  className?: string;
}) {
  return (
    <ol className={cx('relative space-y-1 border-l border-border pl-4', className)}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          data-mg-game={entry.gameId}
          className={cx('relative py-1.5', entry.muted && 'opacity-70')}
        >
          <span
            aria-hidden
            className={cx(
              'absolute -left-[21px] top-3 size-2.5 rounded-full ring-4 ring-bg',
              entry.accent ? ACCENT_CLASSES[entry.accent].dot : 'bg-zinc-400',
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-muted">
              {entry.time}
            </span>
            <div className="min-w-0 flex-1">{entry.content}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
