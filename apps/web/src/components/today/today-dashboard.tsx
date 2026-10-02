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
    { key: 'updates', label: t.counters.updates, value: today.summary.updates, icon: '🔥' },
    { key: 'rewards', label: t.counters.rewards, value: today.summary.rewards, icon: '🎁' },
    { key: 'resets', label: t.counters.resets, value: today.summary.resets, icon: '⏱' },
    {
      key: 'endingSoon',
      label: t.counters.endingSoon,
      value: today.summary.endingSoon,
      icon: '📅',
    },
  ];

  return (
    <div data-mg-scope className="space-y-8">
      <header className="pt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">{t.eyebrow}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
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
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text hover:border-zinc-400"
          >
            {configured ? t.editGames : t.personalizeAction}
          </Link>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="요약">
          {counters.map((counter) => (
            <li key={counter.key} className="rounded-lg border border-border bg-surface px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                <span aria-hidden className="mr-1">
                  {counter.icon}
                </span>
                {counter.label}
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums text-text">{counter.value}</p>
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
