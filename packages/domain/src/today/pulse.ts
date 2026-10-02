/**
 * PULSE: the unified stream of meaningful moments (patch released, event starts/ends,
 * reward available, maintenance, banner start/end, resets) around "now".
 */
import { HOUR_MS } from '../constants';
import type { PulseItem } from '../content';
import type { PulseKind } from '../enums';
import { occurrencesBetween } from '../reset/engine';
import type { ResetRuleDefinition } from '../schemas/reset';
import { toEpochMs } from '../time/zone';
import { effectiveStartMs } from '../urgency/urgency';

export interface PulseMoment {
  /** Stable id: item id or rule id + kind + instant. */
  id: string;
  kind: PulseKind;
  at: string;
  gameId: string;
  title: string;
  href: string | null;
  item: PulseItem | null;
  isFuture: boolean;
}

export interface PulseStreamOptions {
  pastWindowMs: number;
  futureWindowMs: number;
  /** Include DAILY resets (noisy; off by default). */
  includeDailyResets: boolean;
}

const DEFAULT_OPTIONS: PulseStreamOptions = {
  pastWindowMs: 48 * HOUR_MS,
  futureWindowMs: 48 * HOUR_MS,
  includeDailyResets: false,
};

function momentsForItem(item: PulseItem): Array<{ kind: PulseKind; at: number | null }> {
  const start = toEpochMs(item.startAt);
  const end = toEpochMs(item.endAt);
  const published = toEpochMs(item.sourcePublishedAt) ?? toEpochMs(item.publishedAt);
  switch (item.type) {
    case 'PATCH':
      return [{ kind: 'PATCH', at: effectiveStartMs(item) }];
    case 'UPDATE':
      return [{ kind: 'UPDATE', at: effectiveStartMs(item) }];
    case 'EVENT':
      return [
        { kind: 'EVENT_START', at: start },
        { kind: 'EVENT_ENDING', at: end },
      ];
    case 'BANNER':
      return [
        { kind: 'BANNER_START', at: start },
        { kind: 'BANNER_END', at: end },
      ];
    case 'REWARD':
      return [{ kind: 'REWARD', at: start ?? published }];
    case 'REDEEM_CODE':
      return [{ kind: 'REDEEM_CODE', at: published ?? start }];
    case 'MAINTENANCE':
      return [{ kind: 'MAINTENANCE', at: start }];
    case 'ANNOUNCEMENT':
      return [{ kind: 'ANNOUNCEMENT', at: published }];
  }
}

export function buildPulseStream(input: {
  items: readonly PulseItem[];
  resets: readonly ResetRuleDefinition[];
  now: Date;
  gameIds?: readonly string[];
  options?: Partial<PulseStreamOptions>;
}): PulseMoment[] {
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  const nowMs = input.now.getTime();
  const from = nowMs - options.pastWindowMs;
  const to = nowMs + options.futureWindowMs;
  const games = input.gameIds ? new Set(input.gameIds) : null;
  const moments: PulseMoment[] = [];

  for (const item of input.items) {
    if (games && !games.has(item.gameId)) continue;
    for (const { kind, at } of momentsForItem(item)) {
      if (at === null || at < from || at > to) continue;
      moments.push({
        id: `${item.id}:${kind}`,
        kind,
        at: new Date(at).toISOString(),
        gameId: item.gameId,
        title: item.title,
        href: item.href,
        item,
        isFuture: at > nowMs,
      });
    }
  }

  for (const rule of input.resets) {
    if (games && !games.has(rule.gameId)) continue;
    if (rule.frequency === 'DAILY' && !options.includeDailyResets) continue;
    for (const occurrence of occurrencesBetween(rule, new Date(from), new Date(to), 20)) {
      moments.push({
        id: `${rule.id}:RESET:${occurrence.toISOString()}`,
        kind: 'RESET',
        at: occurrence.toISOString(),
        gameId: rule.gameId,
        title: rule.name,
        href: null,
        item: null,
        isFuture: occurrence.getTime() > nowMs,
      });
    }
  }

  return moments.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
