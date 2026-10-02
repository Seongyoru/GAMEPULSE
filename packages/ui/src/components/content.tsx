/**
 * Content components: patch changes, pulse/event cards, source attribution, timeline, resets.
 * Server-compatible; live parts are delegated to <Countdown/>.
 */
import type {
  ContentType,
  GameAccent,
  PatchChangeRecord,
  PatchChangeType,
  RewardItem,
} from '@gamepulse/domain';
import { CalendarDays, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { ACCENT_CLASSES, CHANGE_TYPE_CLASSES, type Tone } from '../tokens';
import { Countdown } from './countdown';
import { artCrop, GameCover, GameMark } from './game-art';
import { TypeIcon } from './icons';
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
  /** `name` is the short name drawn on the game mark (e.g. "원신"). */
  game: { name: string; accent: GameAccent; gameId: string };
  typeLabel: string;
  /** Content type, for its icon. */
  type?: ContentType;
  status?: { tone: Tone; label: string } | null;
  /** Primary time line, e.g. "종료까지" + countdown. */
  meta?: ReactNode;
  summary?: string | null;
  rewards?: readonly RewardItem[];
  sample?: boolean;
  sampleLabel?: string;
  /** Attribution the item's source requires next to its data (e.g. NEXON Open API). */
  attribution?: string | null;
  /** Analytics event name emitted (via delegated listener) when the card is opened. */
  trackEvent?: string;
  /** Extra controls rendered above the link overlay (e.g. a "claimed" button). */
  actions?: ReactNode;
  className?: string;
}

const CARD =
  'group relative rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(15_23_42/0.05)] transition duration-200 hover:-translate-y-px hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-900/5 dark:hover:border-zinc-600 dark:hover:shadow-black/40';

function CardKind({
  game,
  type,
  typeLabel,
}: {
  game: { name: string; accent: GameAccent };
  type?: ContentType;
  typeLabel: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold">
      <span className={cx('truncate', ACCENT_CLASSES[game.accent].text)}>{game.name}</span>
      <span aria-hidden className="text-muted/60">
        ·
      </span>
      <span className="inline-flex items-center gap-1 text-muted">
        {type ? <TypeIcon type={type} className="size-3" /> : null}
        {typeLabel}
      </span>
    </span>
  );
}

/** Compact card for any pulse item. Carries data-mg-game so MY GAMES CSS can hide it pre-hydration. */
export function PulseCard({
  href,
  title,
  game,
  typeLabel,
  type,
  status,
  meta,
  summary,
  rewards,
  sample,
  sampleLabel = '샘플',
  attribution,
  trackEvent,
  actions,
  className,
}: PulseCardProps) {
  return (
    <article data-mg-game={game.gameId} className={cx(CARD, 'flex gap-3 p-3', className)}>
      <GameMark gameId={game.gameId} label={game.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CardKind game={game} type={type} typeLabel={typeLabel} />
          {status ? <StatusChip tone={status.tone}>{status.label}</StatusChip> : null}
          {sample ? <StatusChip tone="sample">{sampleLabel}</StatusChip> : null}
        </div>
        <h3 className="mt-0.5 font-bold leading-snug text-text">
          <Link
            href={href}
            data-track-event={trackEvent}
            data-track-id={href}
            className="after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:underline"
          >
            {title}
          </Link>
        </h3>
        {summary ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{summary}</p> : null}
        {rewards && rewards.length > 0 ? <RewardBadge items={rewards} className="mt-1.5" /> : null}
        <SourceAttributionNote attributions={attribution ? [attribution] : []} className="mt-1" />
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
  /** Content type, for its icon. */
  type?: ContentType;
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
  /** Attribution the item's source requires next to its data (e.g. NEXON Open API). */
  attribution?: string | null;
  trackEvent?: string;
  className?: string;
}

/**
 * Media card for time-bounded content (events, banners): an art thumbnail (a different detail of
 * the game's art per item) next to the facts; the period is always visible.
 */
export function EventCard({
  href,
  title,
  game,
  typeLabel,
  type,
  status,
  period,
  meta,
  rewards,
  featured,
  sample,
  sampleLabel = '샘플',
  attribution,
  trackEvent,
  className,
}: EventCardProps) {
  return (
    <article
      data-mg-game={game.gameId}
      data-testid="event-card"
      className={cx(CARD, 'flex overflow-hidden', className)}
    >
      <GameCover
        gameId={game.gameId}
        crop={artCrop(href)}
        scrim="none"
        className="w-24 shrink-0 sm:w-36"
      >
        <div className="flex h-full flex-col items-start justify-between p-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold leading-none text-white backdrop-blur-sm">
            {type ? <TypeIcon type={type} className="size-3" /> : null}
            {typeLabel}
          </span>
          {sample ? (
            <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-bold leading-none text-fuchsia-800">
              {sampleLabel}
            </span>
          ) : null}
        </div>
      </GameCover>
      <div className="flex min-w-0 flex-1 gap-3 p-3">
        <div className="min-w-0 flex-1">
          {status ? <StatusChip tone={status.tone}>{status.label}</StatusChip> : null}
          <h3 className="mt-1 font-bold leading-snug text-text">
            <Link
              href={href}
              data-track-event={trackEvent}
              data-track-id={href}
              className="after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:underline"
            >
              {title}
            </Link>
          </h3>
          {period ? (
            <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs tabular-nums text-muted">
              <CalendarDays aria-hidden className="size-3.5 shrink-0" />
              {period}
            </p>
          ) : null}
          {featured && featured.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={typeLabel}>
              {featured.map((name) => (
                <li
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2 text-xs font-semibold text-text"
                >
                  <span
                    aria-hidden
                    className={cx(
                      'grid size-5 place-items-center rounded-full text-[10px] font-bold text-white',
                      ACCENT_CLASSES[game.accent].dot,
                    )}
                  >
                    {name.slice(0, 1)}
                  </span>
                  {name}
                </li>
              ))}
            </ul>
          ) : null}
          {rewards && rewards.length > 0 ? <RewardBadge items={rewards} className="mt-2" /> : null}
          <SourceAttributionNote attributions={attribution ? [attribution] : []} className="mt-1" />
        </div>
        {meta ? (
          <div className="flex shrink-0 flex-col items-end justify-center text-right text-sm">
            {meta}
          </div>
        ) : null}
      </div>
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

export interface SourceAttributionNoteProps {
  /** Attribution texts required by the sources of the data shown; renders nothing when empty. */
  attributions: readonly string[];
  className?: string;
}

/** Source-required attribution (e.g. "Data based on NEXON Open API") shown next to that source's data. */
export function SourceAttributionNote({ attributions, className }: SourceAttributionNoteProps) {
  if (attributions.length === 0) return null;
  return (
    <p data-testid="source-attribution" className={cx('text-[11px] text-muted', className)}>
      {attributions.join(' · ')}
    </p>
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
        'flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.05)]',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {game ? (
          <GameMark gameId={game.gameId} label={game.name} size="sm" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
            <RotateCcw aria-hidden className="size-4" />
          </span>
        )}
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
      </div>
      <Countdown
        target={nextAt}
        timeZone={timeZone}
        className="font-display text-base font-bold text-text"
      />
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
              'absolute -left-[21px] top-3.5 size-2.5 rounded-full ring-4 ring-bg',
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
