'use client';

import {
  addMonths,
  buildCalendarMonth,
  listGames,
  toCalendarDate,
  type CalendarEntry,
  type PulseItem,
  type ResetRuleDefinition,
} from '@gamepulse/domain';
import { Calendar, EmptyState, type CalendarCellEntry } from '@gamepulse/ui';
import { GameFilter, useNow } from '@gamepulse/ui/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { track } from '@/lib/analytics';
import { ko } from '@/lib/i18n';
import { useEffectiveGameIds } from '@/lib/preferences';
import { formatInstant, gameView, gameViewById, typeLabel, VIEWER_TIMEZONE } from '@/lib/present';

const ALL_GAMES = listGames().map((game) => {
  const view = gameView(game);
  return { gameId: view.gameId, name: view.shortName, accent: view.accent };
});

export interface CalendarViewProps {
  items: PulseItem[];
  resets: ResetRuleDefinition[];
  generatedAt: string;
  /** Restrict to one game (game calendar pages); hides the game filter. */
  fixedGameId?: string;
}

/**
 * Month view + agenda. Month navigation and game filters are client state over a dataset
 * rendered once, so the page itself stays static and cacheable.
 */
export function CalendarView({ items, resets, generatedAt, fixedGameId }: CalendarViewProps) {
  const serverNow = Date.parse(generatedAt);
  const now = useNow('minute', serverNow);
  const { gameIds: preferred } = useEffectiveGameIds();
  const [override, setOverride] = useState<string[] | null>(null);
  const [offset, setOffset] = useState(0);
  const t = ko.calendar;

  const selected = fixedGameId ? [fixedGameId] : (override ?? preferred);
  const selectedKey = selected.join(',');
  const current = toCalendarDate(new Date(now), VIEWER_TIMEZONE);
  const target = addMonths({ ...current, day: 1 }, offset);

  const month = useMemo(
    () =>
      buildCalendarMonth({
        year: target.year,
        month: target.month,
        timeZone: VIEWER_TIMEZONE,
        now: new Date(now),
        items,
        resets,
        gameIds: selectedKey.split(','),
      }),
    [target.year, target.month, now, items, resets, selectedKey],
  );

  const toCell = (entry: CalendarEntry): CalendarCellEntry => {
    const game = gameViewById(entry.gameId);
    return {
      id: entry.id,
      gameId: entry.gameId,
      accent: game.accent,
      label: entry.title,
      marker: entry.type
        ? `${typeLabel(entry.type, entry.gameId)} ${t.markers[entry.marker]}`
        : t.markers.RESET,
      href: entry.href,
      time: formatInstant(entry.at),
    };
  };

  const byDate = new Map(month.weeks.flat().map((day) => [day.date, day.entries.map(toCell)]));
  const agenda = month.weeks
    .flat()
    .filter((day) => day.inMonth && day.entries.length > 0)
    .map((day) => ({ day, entries: day.entries }));

  const onToggle = (gameId: string) => {
    const base = override ?? preferred;
    const next = base.includes(gameId) ? base.filter((id) => id !== gameId) : [...base, gameId];
    setOverride(next);
    track('calendar_filtered', { gameId, enabled: next.includes(gameId) });
  };

  return (
    <div className="space-y-4">
      {fixedGameId ? null : (
        <GameFilter
          games={ALL_GAMES}
          selected={selected}
          onToggle={onToggle}
          label={t.filterLabel}
        />
      )}
      <div className="overflow-x-auto">
        <Calendar
          month={month}
          weekdayLabels={t.weekdays}
          entriesFor={(date) => byDate.get(date) ?? []}
          moreLabel={t.more}
          className="min-w-[640px]"
          caption={
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-lg font-bold tabular-nums text-text"
                data-testid="calendar-month"
              >
                {target.year}.{String(target.month).padStart(2, '0')}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setOffset(offset - 1)}
                  disabled={offset <= -1}
                  className="rounded border border-border px-2 py-1 text-sm disabled:opacity-40"
                >
                  ← {t.previous}
                </button>
                <button
                  type="button"
                  onClick={() => setOffset(0)}
                  className="rounded border border-border px-2 py-1 text-sm"
                >
                  {t.today}
                </button>
                <button
                  type="button"
                  onClick={() => setOffset(offset + 1)}
                  disabled={offset >= 1}
                  className="rounded border border-border px-2 py-1 text-sm disabled:opacity-40"
                >
                  {t.next} →
                </button>
              </span>
            </div>
          }
        />
      </div>

      <section aria-labelledby="calendar-agenda">
        <h2
          id="calendar-agenda"
          className="mb-2 text-sm font-bold uppercase tracking-wider text-muted"
        >
          {t.agenda}
        </h2>
        {agenda.length === 0 ? (
          <EmptyState title={t.empty} />
        ) : (
          <ol className="space-y-3">
            {agenda.map(({ day, entries }) => (
              <li key={day.date}>
                <p className="mb-1 font-mono text-xs font-bold tabular-nums text-muted">
                  {day.date.replaceAll('-', '.')}
                </p>
                <ul className="space-y-1">
                  {entries.map((entry) => {
                    const game = gameViewById(entry.gameId);
                    const cell = toCell(entry);
                    return (
                      <li
                        key={entry.id}
                        data-agenda-entry={entry.gameId}
                        className="flex flex-wrap items-baseline gap-2 text-sm"
                      >
                        <span className="w-12 font-mono text-xs tabular-nums text-muted">
                          {cell.time.slice(-5)}
                        </span>
                        <span className="font-semibold text-muted">{game.shortName}</span>
                        <span className="text-[11px] font-bold uppercase text-muted">
                          {cell.marker}
                        </span>
                        {entry.href ? (
                          <Link href={entry.href} className="text-text hover:underline">
                            {entry.title}
                          </Link>
                        ) : (
                          <span className="text-text">{entry.title}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
