/**
 * Month grid (presentational). The page decides which entries to show (game filters live in
 * client state); this component only lays them out. Weeks are rows of 7 days.
 */
import type { CalendarMonth, GameAccent } from '@gamepulse/domain';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { ACCENT_CLASSES } from '../tokens';

export interface CalendarCellEntry {
  id: string;
  gameId: string;
  accent: GameAccent;
  label: string;
  marker: string;
  href: string | null;
  time: string;
}

export interface CalendarProps {
  month: CalendarMonth;
  weekdayLabels: readonly string[];
  entriesFor: (date: string) => readonly CalendarCellEntry[];
  maxPerDay?: number;
  moreLabel?: (count: number) => string;
  caption: ReactNode;
  className?: string;
}

export function Calendar({
  month,
  weekdayLabels,
  entriesFor,
  maxPerDay = 4,
  moreLabel = (count) => `+${count}`,
  caption,
  className,
}: CalendarProps) {
  return (
    <table className={cx('w-full table-fixed border-collapse text-left', className)}>
      <caption className="mb-2 text-left">{caption}</caption>
      <thead>
        <tr>
          {weekdayLabels.map((label) => (
            <th
              key={label}
              scope="col"
              className="pb-1 text-center text-xs font-semibold text-muted"
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {month.weeks.map((week) => (
          <tr key={week[0]?.date}>
            {week.map((day) => {
              const entries = entriesFor(day.date);
              return (
                <td
                  key={day.date}
                  data-date={day.date}
                  className={cx(
                    'h-24 border border-border p-1 align-top sm:h-28',
                    !day.inMonth && 'bg-zinc-500/5',
                    day.isToday && 'bg-sky-500/5',
                  )}
                >
                  <div
                    className={cx(
                      'mb-0.5 text-xs font-semibold tabular-nums',
                      day.inMonth ? 'text-text' : 'text-muted/60',
                      day.isToday && 'text-sky-700 dark:text-sky-300',
                    )}
                  >
                    {day.isToday ? (
                      <span className="rounded bg-sky-600 px-1 text-white">{day.day}</span>
                    ) : (
                      day.day
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {entries.slice(0, maxPerDay).map((entry) => {
                      const body = (
                        <>
                          <span
                            aria-hidden
                            className={cx(
                              'mt-1 size-1.5 shrink-0 rounded-full',
                              ACCENT_CLASSES[entry.accent].dot,
                            )}
                          />
                          <span className="truncate">
                            <span className="font-semibold">{entry.marker}</span> {entry.label}
                          </span>
                        </>
                      );
                      return (
                        <li
                          key={entry.id}
                          data-calendar-entry={entry.gameId}
                          title={`${entry.time} ${entry.label}`}
                        >
                          {entry.href ? (
                            <Link
                              href={entry.href}
                              className="flex gap-1 text-[11px] leading-tight text-text hover:underline"
                            >
                              {body}
                            </Link>
                          ) : (
                            <span className="flex gap-1 text-[11px] leading-tight text-text">
                              {body}
                            </span>
                          )}
                        </li>
                      );
                    })}
                    {entries.length > maxPerDay ? (
                      <li className="text-[11px] text-muted">
                        {moreLabel(entries.length - maxPerDay)}
                      </li>
                    ) : null}
                  </ul>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
