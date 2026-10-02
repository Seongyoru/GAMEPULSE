'use client';

import {
  buildGameSnapshot,
  buildToday,
  listPublicGames,
  TODAY_SECTIONS,
  type PulseItem,
  type ResetRuleDefinition,
  type TodayEntry,
  type TodaySectionId,
} from '@gamepulse/domain';
import { AdSlot, EmptyState, SectionHeader, type AdSlotMode } from '@gamepulse/ui';
import { useNow } from '@gamepulse/ui/client';
import { Flame, Gift, Hourglass, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { ko } from '@/lib/i18n';
import { dismissItem, restoreDismissed, useEffectiveGameIds } from '@/lib/preferences';
import { formatCompactDateHeading } from '@/lib/present';
import { PulseItemCard } from '../pulse-item-card';
import { ResetRuleTimer } from '../reset-rule-timer';
import { GameSnapshotCard } from './game-snapshot-card';

export interface TodayDashboardProps {
  items: PulseItem[];
  resets: ResetRuleDefinition[];
  generatedAt: string;
  adsMode: AdSlotMode;
}

const AD_AFTER: readonly TodaySectionId[] = ['rewards'];

function EntryView({ entry, serverNow }: { entry: TodayEntry; serverNow: number }) {
  if (entry.kind === 'reset') return <ResetRuleTimer rule={entry.rule} nextAt={entry.nextAt} />;
  const claimable = entry.item.type === 'REWARD' || entry.item.type === 'REDEEM_CODE';
  return (
    <PulseItemCard
      item={entry.item}
      serverNow={serverNow}
      actions={
        <button
          type="button"
          onClick={() => dismissItem(entry.item.id)}
          className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold text-muted hover:text-text"
          aria-label={`${entry.item.title} ${claimable ? ko.today.claimed : ko.today.hide}`}
        >
          {claimable ? `✓ ${ko.today.claimed}` : ko.today.hide}
        </button>
      }
    />
  );
}

export function TodayDashboard({ items, resets, generatedAt, adsMode }: TodayDashboardProps) {
  const serverNow = Date.parse(generatedAt);
  const now = useNow('minute', serverNow);
  const { gameIds, configured, preferences } = useEffectiveGameIds();
  const t = ko.today;
  const gameKey = gameIds.join(',');
  const dismissed = preferences.dismissedPulseIds;

  const today = useMemo(
    () =>
      buildToday({
        items,
        resets,
        now: new Date(now),
        gameIds: gameKey.split(','),
        options: { dismissedIds: dismissed },
      }),
    [items, resets, now, gameKey, dismissed],
  );
  const snapshots = useMemo(() => {
    const selected = gameKey.split(',');
    return listPublicGames()
      .filter((game) => selected.includes(game.gameId))
      .map((game) => buildGameSnapshot({ gameId: game.gameId, items, resets, now: new Date(now) }));
  }, [gameKey, items, resets, now]);
  const hiddenCount = preferences.dismissedPulseIds.filter((id) =>
    items.some((item) => item.id === id),
  ).length;
  const counters = [
    {
      key: 'updates',
      label: t.counters.updates,
      value: today.summary.updates,
      icon: Flame,
      tile: 'bg-rose-500/12 text-rose-600 dark:text-rose-300',
    },
    {
      key: 'rewards',
      label: t.counters.rewards,
      value: today.summary.rewards,
      icon: Gift,
      tile: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    },
    {
      key: 'resets',
      label: t.counters.resets,
      value: today.summary.resets,
      icon: RotateCcw,
      tile: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    },
    {
      key: 'endingSoon',
      label: t.counters.endingSoon,
      value: today.summary.endingSoon,
      icon: Hourglass,
      tile: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
    },
  ];

  return (
    <div data-mg-scope className="space-y-8">
      <header className="pt-6">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
          {t.eyebrow}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
              <time dateTime={new Date(now).toISOString()}>
                {formatCompactDateHeading(new Date(now))}
              </time>
            </h1>
            <p className="mt-1 text-base font-semibold text-text" data-testid="today-summary">
              {configured
                ? t.summary(today.summary.total)
                : t.summaryAnonymous(today.summary.total)}
            </p>
          </div>
          <Link
            href="/my-games"
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-text shadow-sm hover:border-zinc-400"
          >
            {configured ? t.editGames : t.personalizeAction}
          </Link>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="요약">
          {counters.map((counter) => (
            <li
              key={counter.key}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.05)]"
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${counter.tile}`}
              >
                <counter.icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-muted">
                  {counter.label}
                </span>
                <span className="block font-display text-2xl font-bold leading-tight tabular-nums text-text">
                  {counter.value}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {!configured ? <p className="mt-3 text-sm text-muted">{t.personalize}</p> : null}
      </header>

      <section aria-label="게임별 현황" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshots.map((snapshot) => (
          <GameSnapshotCard key={snapshot.gameId} snapshot={snapshot} />
        ))}
      </section>

      {today.summary.total === 0 &&
      TODAY_SECTIONS.every((id) => today.sections[id].length === 0) ? (
        <EmptyState
          title={t.empty}
          action={
            <Link
              href="/my-games"
              className="text-sm font-semibold text-sky-700 underline dark:text-sky-300"
            >
              {t.editGames}
            </Link>
          }
        />
      ) : null}

      {TODAY_SECTIONS.map((sectionId) => {
        const entries = today.sections[sectionId];
        if (entries.length === 0) return null;
        const meta = t.sections[sectionId];
        return (
          <div key={sectionId} className="space-y-8">
            <section
              aria-labelledby={`today-${sectionId}`}
              data-testid={`today-section-${sectionId}`}
            >
              <SectionHeader
                id={`today-${sectionId}`}
                eyebrow={meta.eyebrow}
                title={meta.title}
                count={entries.length}
              />
              <div className="grid gap-2">
                {entries.map((entry) => (
                  <EntryView
                    key={entry.kind === 'item' ? entry.item.id : `${entry.rule.id}:${entry.nextAt}`}
                    entry={entry}
                    serverNow={serverNow}
                  />
                ))}
              </div>
            </section>
            {AD_AFTER.includes(sectionId) ? (
              <AdSlot placement="today-between-sections" mode={adsMode} />
            ) : null}
          </div>
        );
      })}

      {hiddenCount > 0 ? (
        <p className="text-sm text-muted">
          {t.hiddenCount(hiddenCount)} ·{' '}
          <button
            type="button"
            className="font-semibold text-text underline"
            onClick={restoreDismissed}
          >
            {t.restoreHidden}
          </button>
        </p>
      ) : null}
    </div>
  );
}
