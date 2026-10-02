/**
 * Per-game "10-second" snapshot: the handful of facts shown on each game card of the
 * dashboard (latest patch, next patch, primary reset, rewards, events, banner, maintenance).
 * Generic over all games — which rows render is driven by data and GameConfig.features.
 */
import type { PulseItem } from '../content';
import type { MaintenanceState } from '../enums';
import { nextOccurrence } from '../reset/engine';
import type { ResetRuleDefinition } from '../schemas/reset';
import { computeMaintenanceState, computeStatusForType, isClaimable } from '../status/status';
import { toEpochMs } from '../time/zone';
import { effectiveStartMs } from '../urgency/urgency';

export interface SnapshotLink {
  href: string;
  title: string;
}

export interface GameSnapshot {
  gameId: string;
  latestPatch: (SnapshotLink & { version: string | null; changeCount: number; at: string }) | null;
  nextPatch: (SnapshotLink & { version: string | null; at: string }) | null;
  primaryReset: { ruleId: string; name: string; nextAt: string } | null;
  upcomingResets: Array<{ ruleId: string; name: string; nextAt: string }>;
  rewardsAvailable: number;
  currentEvents: number;
  endingSoonEvent: (SnapshotLink & { endAt: string }) | null;
  currentBanner: (SnapshotLink & { endAt: string | null; featured: string[] }) | null;
  maintenance:
    | (SnapshotLink & { state: MaintenanceState; startAt: string | null; endAt: string | null })
    | null;
  lastUpdatedAt: string | null;
}

const MAINTENANCE_LOOKAHEAD_MS = 3 * 24 * 60 * 60 * 1000;

function byEarliest<T>(items: T[], key: (item: T) => number | null): T | undefined {
  return items
    .filter((item) => key(item) !== null)
    .sort((a, b) => (key(a) ?? 0) - (key(b) ?? 0))[0];
}

export function buildGameSnapshot(input: {
  gameId: string;
  items: readonly PulseItem[];
  resets: readonly ResetRuleDefinition[];
  now: Date;
}): GameSnapshot {
  const nowMs = input.now.getTime();
  const items = input.items.filter((item) => item.gameId === input.gameId);
  const status = (item: PulseItem) => computeStatusForType(item.type, item, nowMs);

  const patches = items.filter((item) => item.type === 'PATCH');
  const released = patches
    .filter((item) => {
      const at = effectiveStartMs(item);
      return at !== null && at <= nowMs;
    })
    .sort((a, b) => (effectiveStartMs(b) ?? 0) - (effectiveStartMs(a) ?? 0))[0];
  const upcomingPatch = byEarliest(
    patches.filter((item) => status(item) === 'UPCOMING'),
    (item) => toEpochMs(item.startAt),
  );

  const ruleOccurrences = input.resets
    .filter((rule) => rule.gameId === input.gameId)
    .map((rule) => ({ rule, next: nextOccurrence(rule, input.now) }))
    .filter((entry): entry is { rule: ResetRuleDefinition; next: Date } => entry.next !== null)
    .sort((a, b) => a.next.getTime() - b.next.getTime());
  const primary = ruleOccurrences.find((entry) => entry.rule.isPrimary) ?? ruleOccurrences[0];

  const activeEvents = items.filter((item) => {
    if (item.type !== 'EVENT') return false;
    const s = status(item);
    return s === 'LIVE' || s === 'ENDING_SOON';
  });
  const endingSoon = byEarliest(
    activeEvents.filter((item) => status(item) === 'ENDING_SOON'),
    (item) => toEpochMs(item.endAt),
  );

  const activeBanners = items.filter((item) => {
    if (item.type !== 'BANNER') return false;
    const s = status(item);
    return s === 'LIVE' || s === 'ENDING_SOON';
  });
  const banner =
    byEarliest(activeBanners, (item) => toEpochMs(item.endAt)) ?? activeBanners[0] ?? undefined;

  const maintenanceCandidates = items
    .filter((item) => item.type === 'MAINTENANCE')
    .map((item) => ({ item, state: computeMaintenanceState(item, nowMs) }))
    .filter(({ item, state }) => {
      if (state === 'IN_PROGRESS') return true;
      const start = toEpochMs(item.startAt);
      return state === 'SCHEDULED' && start !== null && start - nowMs <= MAINTENANCE_LOOKAHEAD_MS;
    })
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === 'IN_PROGRESS' ? -1 : 1;
      return (toEpochMs(a.item.startAt) ?? 0) - (toEpochMs(b.item.startAt) ?? 0);
    });
  const maintenance = maintenanceCandidates[0];

  const lastUpdated = items
    .map((item) => toEpochMs(item.updatedAt))
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => b - a)[0];

  return {
    gameId: input.gameId,
    latestPatch: released
      ? {
          href: released.href,
          title: released.title,
          version: released.facts.version ?? null,
          changeCount: released.facts.changeCount ?? 0,
          at: new Date(effectiveStartMs(released) ?? nowMs).toISOString(),
        }
      : null,
    nextPatch:
      upcomingPatch && upcomingPatch.startAt
        ? {
            href: upcomingPatch.href,
            title: upcomingPatch.title,
            version: upcomingPatch.facts.version ?? null,
            at: upcomingPatch.startAt,
          }
        : null,
    primaryReset: primary
      ? { ruleId: primary.rule.id, name: primary.rule.name, nextAt: primary.next.toISOString() }
      : null,
    upcomingResets: ruleOccurrences.slice(0, 3).map(({ rule, next }) => ({
      ruleId: rule.id,
      name: rule.name,
      nextAt: next.toISOString(),
    })),
    rewardsAvailable: items.filter(
      (item) => (item.type === 'REWARD' || item.type === 'REDEEM_CODE') && isClaimable(item, nowMs),
    ).length,
    currentEvents: activeEvents.length,
    endingSoonEvent:
      endingSoon && endingSoon.endAt
        ? { href: endingSoon.href, title: endingSoon.title, endAt: endingSoon.endAt }
        : null,
    currentBanner: banner
      ? {
          href: banner.href,
          title: banner.title,
          endAt: banner.endAt,
          featured: banner.facts.featured ?? [],
        }
      : null,
    maintenance: maintenance
      ? {
          href: maintenance.item.href,
          title: maintenance.item.title,
          state: maintenance.state,
          startAt: maintenance.item.startAt,
          endAt: maintenance.item.endAt,
        }
      : null,
    lastUpdatedAt: lastUpdated === undefined ? null : new Date(lastUpdated).toISOString(),
  };
}
